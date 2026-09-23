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
 
 
def _detail(mission, request):
    """
    One mission, serialized for a client.

    The request has to reach the serializer: without it DRF renders the photo
    FileField as the relative "/media/...", which a browser resolves against
    the dashboard's own origin rather than the API's, and every piece of photo
    evidence comes out as a broken image. With it, each client is handed a URL
    that works from where it is asking.
    """
    return MissionDetailSerializer(mission, context={"request": request}).data


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
        return Response(_detail(mission, self.request))
 
 
class FilterError(Exception):
    """A query parameter the list cannot honour; the view answers 400."""


def _one_of(request, name, allowed):
    """
    A filter whose value must come from a fixed set.

    An unknown value is a mistake worth reporting: returning an empty list
    instead would look like "no missions match" and hide the typo.
    """
    value = request.query_params.get(name)
    if not value:
        return None
    if value not in allowed:
        raise FilterError(f"{name} must be one of: {', '.join(allowed)}.")
    return value


def _an_id(request, name):
    """An id filter. A non-numeric value used to reach the database and 500."""
    value = request.query_params.get(name)
    if not value:
        return None
    if not value.isdigit():
        raise FilterError(f"{name} must be a number.")
    return int(value)


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
            OpenApiParameter("category", description="Municipal, Sanitation, Traffic, Infrastructure"),
            OpenApiParameter("officer_id", description="Filter by assigned officer.", type=int),
            OpenApiParameter("area_id", description="Filter by the district the mission is in.", type=int),
            OpenApiParameter("date", description="Missions created on this day, YYYY-MM-DD."),
            OpenApiParameter("open", description="true for missions not yet closed."),
        ],
        responses=MissionListSerializer(many=True),
    )
    def get(self, request):
        queryset = Mission.objects.select_related("created_by", "area").prefetch_related(
            "assigned_to"
        )

        try:
            officer_id = _an_id(request, "officer_id")
            area_id = _an_id(request, "area_id")
            mission_status = _one_of(request, "status", Mission.Status.values)
            priority = _one_of(request, "priority", Mission.Priority.values)
            category = _one_of(request, "category", Mission.Category.values)
        except FilterError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role == "officer":
            queryset = queryset.filter(assigned_to=request.user)
        elif officer_id is not None:
            queryset = queryset.filter(assigned_to__id=officer_id)

        if mission_status:
            queryset = queryset.filter(status=mission_status)
        if priority:
            queryset = queryset.filter(priority=priority)
        if category:
            queryset = queryset.filter(category=category)
        if area_id is not None:
            queryset = queryset.filter(area_id=area_id)
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
                    "assigned_to_ids": [4, 7],
                },
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = MissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
 
        officer_ids = data.pop("assigned_to_ids", [])
        officers = list(User.objects.filter(pk__in=officer_ids, is_active=True))
        if len(officers) != len(set(officer_ids)):
            return Response(
                {"detail": "One or more officers are not active users."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            mission = services.create_mission(
                created_by=request.user, officers=officers, **data
            )
        except services.MissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
 
        return Response(_detail(mission, request), status=status.HTTP_201_CREATED)
 
 
class MissionDetailView(APIView, MissionActionMixin):
    """GET /api/v1/missions/{id}/ - the drawer, with the full timeline (§4.6)."""
 
    permission_classes = [IsAuthenticated]
    serializer_class = MissionDetailSerializer
 
    @extend_schema(responses=MissionDetailSerializer)
    def get(self, request, mission_id: int):
        mission = get_object_or_404(
            Mission.objects.select_related("created_by").prefetch_related(
                "assigned_to",
                Prefetch("events", queryset=MissionEvent.objects.select_related("actor")),
                "photos",
            ),
            pk=mission_id,
        )

        if request.user.role == "officer" and not mission.assigned_to.filter(pk=request.user.id).exists():
            return Response(
                {"detail": "This mission is not assigned to you."},
                status=status.HTTP_403_FORBIDDEN,
            )
 
        return Response(_detail(mission, request))
 
 
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
        officer_ids = serializer.validated_data["officer_ids"]
        officers = list(User.objects.filter(pk__in=officer_ids, is_active=True))
        if len(officers) != len(set(officer_ids)):
            return Response(
                {"detail": "One or more officers are not active users."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Same endpoint for both, because the caller is doing the same thing;
        # which one it is depends on whether the mission already has officers.
        action = (
            services.reassign_mission
            if mission.status == Mission.Status.ASSIGNED
            else services.assign_mission
        )
        return self.run(action, mission, officers=officers, actor=request.user)
 
 
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
        if request.user.role == "officer" and not mission.assigned_to.filter(pk=request.user.id).exists():
            return Response(
                {"detail": "This mission is not assigned to you."},
                status=status.HTTP_403_FORBIDDEN,
            )
 
        try:
            services.add_note(mission, actor=request.user, text=serializer.validated_data["text"])
        except services.MissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
 
        mission.refresh_from_db()
        return Response(_detail(mission, request))
 
 
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
 
