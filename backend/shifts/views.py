from django.shortcuts import render

# Create your views here.
from datetime import datetime, time

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsDispatcherOrSupervisor, IsOfficer

from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import serializers

from . import services
from .models import LocationPing, Shift
from .serializers import (
    ActiveOfficerSerializer,
    BulkLocationPingSerializer,
    EndShiftSerializer,
    LocationPingSerializer,
    ShiftBoundarySerializer,
    ShiftSerializer,
)
class IngestResultSerializer(serializers.Serializer):
    """What POST /location-pings/bulk/ returns."""

    accepted = serializers.IntegerField()
    duplicates = serializers.IntegerField()
    rejected = serializers.IntegerField()


class TrailSerializer(serializers.Serializer):
    """What GET /officers/{id}/trail/ returns."""

    officer_id = serializers.IntegerField()
    date = serializers.DateField()
    point_count = serializers.IntegerField()
    distance_covered_m = serializers.IntegerField()
    points = LocationPingSerializer(many=True)

class StartShiftView(APIView):
    """
    POST /api/v1/shifts/start/ — §4.2. Idempotent; retrying is safe.

    Optional body: {"latitude": ..., "longitude": ...} for the position where
    the officer went on duty.
    """

    permission_classes = [IsAuthenticated, IsOfficer]
    serializer_class = ShiftBoundarySerializer

    @extend_schema(
        request=ShiftBoundarySerializer,
        responses={201: ShiftSerializer, 200: ShiftSerializer},
        examples=[
            OpenApiExample(
                "With position",
                value={"latitude": 34.436700, "longitude": 35.849700},
                request_only=True,
            ),
            OpenApiExample("No GPS fix yet", value={}, request_only=True),
        ],
    )
    def post(self, request):
        boundary = ShiftBoundarySerializer(data=request.data or {})
        boundary.is_valid(raise_exception=True)

        shift, created = services.start_shift(
            request.user,
            latitude=boundary.validated_data.get("latitude"),
            longitude=boundary.validated_data.get("longitude"),
        )
        return Response(
            ShiftSerializer(shift).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class EndShiftView(APIView):
    """
    POST /api/v1/shifts/end/ — §4.2 stops tracking.

    §4.1 also requires the session to end here. Pass the refresh token in the
    body and it is blacklisted, which is the only way to revoke a JWT.
    """

    permission_classes = [IsAuthenticated, IsOfficer]
    serializer_class = EndShiftSerializer

    @extend_schema(
        request=EndShiftSerializer,
        responses={200: ShiftSerializer},
        examples=[
            OpenApiExample(
                "End shift and revoke the session",
                value={
                    "latitude": 34.446700,
                    "longitude": 35.849700,
                    "refresh": "<refresh token>",
                },
                request_only=True,
            ),
            OpenApiExample("No GPS fix", value={}, request_only=True),
        ],
    )
    def post(self, request):
        boundary = ShiftBoundarySerializer(data=request.data or {})
        boundary.is_valid(raise_exception=True)

        try:
            shift = services.end_shift(
                request.user,
                latitude=boundary.validated_data.get("latitude"),
                longitude=boundary.validated_data.get("longitude"),
            )
        except services.ShiftError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        refresh = request.data.get("refresh") if isinstance(request.data, dict) else None
        if refresh:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken

                RefreshToken(refresh).blacklist()
            except Exception:
                # A bad or already-blacklisted token must not fail End Shift.
                pass

        return Response(ShiftSerializer(shift).data, status=status.HTTP_200_OK)


class BulkLocationPingView(APIView):
    """
    POST /api/v1/location-pings/bulk/ — §4.3 batch ingest.

    Returns counts rather than rows: the phone only needs to know the batch
    landed so it can clear those rows from Room.
    """

    permission_classes = [IsAuthenticated, IsOfficer]
    def post(self, request):
        serializer = BulkLocationPingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = services.ingest_pings(request.user, serializer.validated_data["pings"])
        except services.ShiftError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)

        return Response(
            {
                "accepted": result.accepted,
                "duplicates": result.duplicates,
                "rejected": result.rejected,
            },
            status=status.HTTP_201_CREATED,
        )


class ActiveShiftsView(APIView):
    """
    GET /api/v1/shifts/active/ — §4.6, the dashboard map.

    Poll this every 15s; §4.6 asks for 15-30s refresh, which polling meets
    without a socket layer.
    """

    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]

    def get(self, request):
        shifts = (
            Shift.objects.filter(status=Shift.Status.ACTIVE)
            .select_related("officer")
            .order_by("started_at")
        )

        payload = []
        for shift in shifts:
            latest = shift.pings.order_by("-recorded_at").first()
            payload.append(
                {
                    "officer": {
                        "id": shift.officer_id,
                        "full_name": shift.officer.full_name,
                        "badge_number": shift.officer.badge_number,
                    },
                    # §4.6 colours: available (green) / on_mission (blue).
                    # Hardcoded until the missions app lands; the field exists
                    # now so web does not have to change shape later.
                    "status": "available",
                    "shift_started_at": shift.started_at,
                    "shift_duration_seconds": shift.duration_seconds,
                    "distance_covered_m": services.shift_distance_m(shift),
                    "latest_ping": LocationPingSerializer(latest).data if latest else None,
                    "current_mission": None,
                }
            )

        return Response(ActiveOfficerSerializer(payload, many=True).data)


class OfficerTrailView(APIView):
    """
    GET /api/v1/officers/{id}/trail/?date=YYYY-MM-DD — §4.6 the day's path.

    §5 also gives an officer the right to see their own history, so an officer
    may call this for themselves and no one else.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, officer_id: int):
        is_self = request.user.id == officer_id
        is_staff_role = request.user.role in {"dispatcher", "supervisor"}
        if not (is_self or is_staff_role):
            return Response(
                {"detail": "You can only view your own location history."},
                status=status.HTTP_403_FORBIDDEN,
            )

        raw_date = request.query_params.get("date")
        if raw_date:
            try:
                day = datetime.strptime(raw_date, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"detail": "Use date=YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            day = timezone.localdate()

        # §5 stores UTC and displays Beirut; the day boundary is the local one.
        tz = timezone.get_current_timezone()
        start = timezone.make_aware(datetime.combine(day, time.min), tz)
        end = timezone.make_aware(datetime.combine(day, time.max), tz)

        pings = LocationPing.objects.filter(
            officer_id=officer_id, recorded_at__gte=start, recorded_at__lte=end
        ).order_by("recorded_at")  # never received_at

        return Response(
            {
                "officer_id": officer_id,
                "date": day.isoformat(),
                "point_count": pings.count(),
                "distance_covered_m": services.trail_distance_m(pings),
                "points": LocationPingSerializer(pings, many=True).data,
            }
        )
