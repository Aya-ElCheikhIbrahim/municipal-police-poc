from datetime import datetime, time

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsDispatcherOrSupervisor, IsOfficer
from missions.models import Mission
from panic.models import PanicEvent

from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import serializers

from . import services
from .models import LocationPing, Shift
from .serializers import (
    ActiveOfficerSerializer,
    BulkLocationPingSerializer,
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

    §4.1 also requires the session to end, but revoking the JWT is
    POST /api/v1/logout/'s job; the client calls it separately. Doing it here
    too meant a failed blacklist still returned 200, so a phone could believe
    its session was revoked when it was not.
    """

    permission_classes = [IsAuthenticated, IsOfficer]
    serializer_class = ShiftBoundarySerializer

    @extend_schema(
        request=ShiftBoundarySerializer,
        responses={200: ShiftSerializer},
        examples=[
            OpenApiExample(
                "With position",
                value={"latitude": 34.446700, "longitude": 35.849700},
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

        return Response(ShiftSerializer(shift).data, status=status.HTTP_200_OK)


class BulkLocationPingView(APIView):
    """
    POST /api/v1/location-pings/bulk/ — §4.3 batch ingest.

    Returns counts rather than rows: the phone only needs to know the batch
    landed so it can clear those rows from Room.
    """

    permission_classes = [IsAuthenticated, IsOfficer]
    serializer_class = BulkLocationPingSerializer

    @extend_schema(
        request=BulkLocationPingSerializer,
        responses={201: IngestResultSerializer},
        examples=[
            OpenApiExample(
                "One fix",
                value={
                    "pings": [
                        {
                            "client_uuid": "3f8a1c92-7d64-4e11-b0a5-9c2d81e4f7a3",
                            "latitude": 34.451028,
                            "longitude": 35.810472,
                            "accuracy_m": 12.5,
                            "battery_level": 78,
                            "network_type": "mobile",
                            "recorded_at": "2026-09-10T17:30:00+03:00"
                        }
                    ]
                },
                request_only=True,
            )
        ],
    )
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
        shifts = list(
            Shift.objects.filter(status=Shift.Status.ACTIVE)
            .select_related("officer")
            .order_by("started_at")
        )

        # DISTINCT ON is Postgres-specific, but both the project and its test
        # database run Postgres, so one query for every shift's latest ping
        # (instead of one query per officer) is deliberate here.
        latest = {
            p.shift_id: p
            for p in LocationPing.objects
                .filter(shift_id__in=[s.id for s in shifts])
                .order_by("shift_id", "-recorded_at")
                .distinct("shift_id")
        }

        Assignment = Mission.assigned_to.through
        missions = {
            row.user_id: row.mission
            for row in Assignment.objects
                .filter(
                    user_id__in=[s.officer_id for s in shifts],
                    mission__status__in=[
                        Mission.Status.ACKNOWLEDGED,
                        Mission.Status.IN_PROGRESS,
                    ],
                )
                .select_related("mission")
                .order_by("user_id", "-mission__assigned_at")
                .distinct("user_id")
        }

        # Same one-query shape again: which of these officers has an open
        # panic alert right now. Checked ahead of mission/available so a
        # panicking officer never gets outranked by "on a mission" — the red
        # marker (§4.6) and the dashboard's panic banner both key off this
        # same field, so this is the one place that has to get it right.
        active_panics = {
            p.officer_id: p
            for p in PanicEvent.objects.filter(
                officer_id__in=[s.officer_id for s in shifts],
                status=PanicEvent.Status.ACTIVE,
            )
        }
        panicking_officer_ids = set(active_panics)

        payload = []
        for shift in shifts:
            ping = latest.get(shift.id)
            mission = missions.get(shift.officer_id)
            panic = active_panics.get(shift.officer_id)
            if panic is not None and (ping is None or panic.triggered_at > ping.recorded_at):
                position = {
                    "latitude": panic.latitude,
                    "longitude": panic.longitude,
                    "accuracy_m": panic.accuracy_m,
                    "battery_level": panic.battery_level,
                    "network_type": LocationPing.NetworkType.UNKNOWN,
                    "recorded_at": panic.triggered_at,
                    "received_at": panic.triggered_at,
                    "is_offline_sync": False,
                }
                source = "panic"
            elif ping is not None:
                position = LocationPingSerializer(ping).data
                source = "ping"
            elif shift.start_latitude is not None:
                position = {
                    "latitude": shift.start_latitude,
                    "longitude": shift.start_longitude,
                    "accuracy_m": None,
                    "battery_level": None,
                    "network_type": LocationPing.NetworkType.UNKNOWN,
                    "recorded_at": shift.started_at,
                    "received_at": shift.started_at,
                    "is_offline_sync": False,
                }
                source = "shift_start"
            else:
                position, source = None, None
            payload.append(
                {
                    "officer": {
                        "id": shift.officer_id,
                        "full_name": shift.officer.full_name,
                        "badge_number": shift.officer.badge_number,
                    },
                    "status": (
                        "panic"
                        if shift.officer_id in panicking_officer_ids
                        else "in_mission" if mission is not None else "available"
                    ),
                    "shift_started_at": shift.started_at,
                    "shift_duration_seconds": shift.duration_seconds,
                    "distance_covered_m": shift.distance_m,
                    "latest_ping": position,
                    "position_source": source,
                    "current_mission": mission,
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
