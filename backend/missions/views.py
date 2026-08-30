from django.shortcuts import render

# Create your views here.
from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
 
from core.permissions import IsDispatcherOrSupervisor, IsOfficer
 
from . import services
from .models import Mission, MissionEvent
from .serializers import (
    AssignSerializer,
    CancelSerializer,
    CompleteSerializer,
    MissionCreateSerializer,
    MissionDetailSerializer,
    MissionListSerializer,
    MissionPhotoSerializer,
    NoteSerializer,
    PhotoUploadSerializer,
    PositionSerializer,
)
 
User = get_user_model()
 
 
class MissionActionMixin:
    """
    Shared plumbing for the transition endpoints.
 
    Every one of them is: load the mission, call one function in services,
    return the mission. Keeping the error translation in one place means a
    rule violation reports the same way from every endpoint.
    """
 
    def get_mission(self, mission_id: int) -> Mission:
        return get_object_or_404(Mission, pk=mission_id)
 
    def run(self, fn, *args, **kwargs) -> Response:
        try:
            mission = fn(*args, **kwargs)
        except services.MissionPermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.MissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MissionDetailSerializer(mission).data)
 
 
class MissionListCreateView(APIView):
    """
    GET  /api/v1/missions/  - list, filtered. Officers see only their own.
    POST /api/v1/missions/  - create (§4.4). Dispatcher and supervisor only.
    """
 
    permission_classes = [IsAuthenticated]
    serializer_class = MissionListSerializer
 
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsDispatcherOrSupervisor()]
        return [IsAuthenticated()]
 
    @extend_schema(
        parameters=[
            OpenApiParameter("status", description="new, assigned, acknowledged, in_progress, completed, cancelled"),
            OpenApiParameter("priority", description="low, medium, high, urgent"),
            OpenApiParameter("officer_id", description="Filter by assigned officer.", type=int),
            OpenApiParameter("date", description="Missions created on this day, YYYY-MM-DD."),
            OpenApiParameter("open", description="true for missions not yet closed."),
        ],
        responses=MissionListSerializer(many=True),
    )
    def get(self, request):
        queryset = Mission.objects.select_related("assigned_to", "created_by")
 
        # §5 — an officer sees their own work, not the whole city's.
        if request.user.role == "officer":
            queryset = queryset.filter(assigned_to=request.user)
        elif officer_id := request.query_params.get("officer_id"):
            queryset = queryset.filter(assigned_to_id=officer_id)
 
        if value := request.query_params.get("status"):
            queryset = queryset.filter(status=value)
        if value := request.query_params.get("priority"):
            queryset = queryset.filter(priority=value)
        if request.query_params.get("open") == "true":
            queryset = queryset.exclude(
                status__in=[Mission.Status.COMPLETED, Mission.Status.CANCELLED]
            )
        if raw_date := request.query_params.get("date"):
            from datetime import datetime
 
            try:
                day = datetime.strptime(raw_date, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"detail": "Use date=YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(created_at__date=day)
 
        return Response(MissionListSerializer(queryset, many=True).data)
 
    @extend_schema(
        request=MissionCreateSerializer,
        responses={201: MissionDetailSerializer},
        examples=[
            OpenApiExample(
                "Create and assign in one step",
                value={
                    "title": "Traffic obstruction on Al-Mina road",
                    "description": "Abandoned vehicle blocking the right lane.",
                    "latitude": 34.436700,
                    "longitude": 35.849700,
                    "address": "Al-Mina, Tripoli",
                    "priority": "high",
                    "assigned_to_id": 4,
                },
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = MissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
 
        officer = None
        if officer_id := data.pop("assigned_to_id", None):
            officer = User.objects.filter(pk=officer_id, is_active=True).first()
            if officer is None:
                return Response(
                    {"detail": "No active user with that id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
 
        try:
            mission = services.create_mission(
                created_by=request.user, assigned_to=officer, **data
            )
        except services.MissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
 
        return Response(
            MissionDetailSerializer(mission).data, status=status.HTTP_201_CREATED
        )
 
 
class MissionDetailView(APIView, MissionActionMixin):
    """GET /api/v1/missions/{id}/ - the drawer, with the full timeline (§4.6)."""
 
    permission_classes = [IsAuthenticated]
    serializer_class = MissionDetailSerializer
 
    @extend_schema(responses=MissionDetailSerializer)
    def get(self, request, mission_id: int):
        mission = get_object_or_404(
            Mission.objects.select_related("assigned_to", "created_by").prefetch_related(
                Prefetch("events", queryset=MissionEvent.objects.select_related("actor")),
                "photos",
            ),
            pk=mission_id,
        )
 
        if request.user.role == "officer" and mission.assigned_to_id != request.user.id:
            return Response(
                {"detail": "This mission is not assigned to you."},
                status=status.HTTP_403_FORBIDDEN,
            )
 
        return Response(MissionDetailSerializer(mission).data)
 
 
class MissionAssignView(APIView, MissionActionMixin):
    """
    POST /api/v1/missions/{id}/assign/ - assign, or reassign before it has
    been acknowledged (§4.4). Dispatcher and supervisor only.
    """
 
    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]
    serializer_class = AssignSerializer
 
    @extend_schema(request=AssignSerializer, responses=MissionDetailSerializer)
    def post(self, request, mission_id: int):
        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
 
        mission = self.get_mission(mission_id)
        officer = User.objects.filter(
            pk=serializer.validated_data["officer_id"], is_active=True
        ).first()
        if officer is None:
            return Response(
                {"detail": "No active user with that id."},
                status=status.HTTP_400_BAD_REQUEST,
            )
 
        # Same endpoint for both, because the caller is doing the same thing;
        # which one it is depends on whether the mission already has an officer.
        action = (
            services.reassign_mission
            if mission.status == Mission.Status.ASSIGNED
            else services.assign_mission
        )
        return self.run(action, mission, officer=officer, actor=request.user)
 
 
class MissionAcknowledgeView(APIView, MissionActionMixin):
    """POST /api/v1/missions/{id}/acknowledge/ - officer confirms receipt (§4.9)."""
 
    permission_classes = [IsAuthenticated, IsOfficer]
 
    @extend_schema(request=None, responses=MissionDetailSerializer)
    def post(self, request, mission_id: int):
        return self.run(
            services.acknowledge_mission, self.get_mission(mission_id), officer=request.user
        )
 
 
class MissionStartView(APIView, MissionActionMixin):
    """POST /api/v1/missions/{id}/start/ - officer is on it."""
 
    permission_classes = [IsAuthenticated, IsOfficer]
    serializer_class = PositionSerializer
 
    @extend_schema(request=PositionSerializer, responses=MissionDetailSerializer)
    def post(self, request, mission_id: int):
        serializer = PositionSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        return self.run(
            services.start_mission,
            self.get_mission(mission_id),
            officer=request.user,
            **serializer.validated_data,
        )
 
 
class MissionCompleteView(APIView, MissionActionMixin):
    """POST /api/v1/missions/{id}/complete/ - officer finished (§4.4)."""
 
    permission_classes = [IsAuthenticated, IsOfficer]
    serializer_class = CompleteSerializer
 
    @extend_schema(request=CompleteSerializer, responses=MissionDetailSerializer)
    def post(self, request, mission_id: int):
        serializer = CompleteSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        return self.run(
            services.complete_mission,
            self.get_mission(mission_id),
            officer=request.user,
            **serializer.validated_data,
        )
 
 
class MissionCancelView(APIView, MissionActionMixin):
    """POST /api/v1/missions/{id}/cancel/ - reason required (§4.4)."""
 
    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]
    serializer_class = CancelSerializer
 
    @extend_schema(
        request=CancelSerializer,
        responses=MissionDetailSerializer,
        examples=[
            OpenApiExample(
                "Cancel a duplicate",
                value={"reason": "Duplicate of mission #12."},
                request_only=True,
            )
        ],
    )
    def post(self, request, mission_id: int):
        serializer = CancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.run(
            services.cancel_mission,
            self.get_mission(mission_id),
            actor=request.user,
            reason=serializer.validated_data["reason"],
        )
 
 
class MissionNoteView(APIView, MissionActionMixin):
    """POST /api/v1/missions/{id}/notes/ - append to the timeline."""
 
    permission_classes = [IsAuthenticated]
    serializer_class = NoteSerializer
 
    @extend_schema(request=NoteSerializer, responses=MissionDetailSerializer)
    def post(self, request, mission_id: int):
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
 
        mission = self.get_mission(mission_id)
        if request.user.role == "officer" and mission.assigned_to_id != request.user.id:
            return Response(
                {"detail": "This mission is not assigned to you."},
                status=status.HTTP_403_FORBIDDEN,
            )
 
        try:
            services.add_note(mission, actor=request.user, text=serializer.validated_data["text"])
        except services.MissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
 
        mission.refresh_from_db()
        return Response(MissionDetailSerializer(mission).data)
 
 
class MissionPhotoView(APIView, MissionActionMixin):
    """
    POST /api/v1/missions/{id}/photos/ - attach evidence (§4.4).
 
    Multipart, and deduped on client_uuid. A retried upload returns 200 with
    the existing photo rather than an error, so the phone can clear its queue.
    """
 
    permission_classes = [IsAuthenticated, IsOfficer]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = PhotoUploadSerializer
 
    @extend_schema(
        request=PhotoUploadSerializer,
        responses={201: MissionPhotoSerializer, 200: MissionPhotoSerializer},
    )
    def post(self, request, mission_id: int):
        serializer = PhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
 
        try:
            photo, created = services.add_photo(
                self.get_mission(mission_id),
                officer=request.user,
                **serializer.validated_data,
            )
        except services.MissionPermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.MissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
 
        return Response(
            MissionPhotoSerializer(photo).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
 
 
class UnacknowledgedSweepView(APIView):
    """
    POST /api/v1/missions/sweep-unacknowledged/ - §4.9.
 
    Flags missions nobody has acknowledged within the configured timeout, once
    each. The dashboard can call this on its poll; it is safe to repeat.
    """
 
    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]
 
    @extend_schema(request=None, responses=MissionListSerializer(many=True))
    def post(self, request):
        flagged = services.flag_unacknowledged()
        return Response(MissionListSerializer(flagged, many=True).data)
 