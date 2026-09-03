"""
panic/views.py — HTTP only. Every rule lives in services.py.

Four endpoints, which is the whole of §4.7. No list-all and no filters: the
history views arrive with reports, and shipping a half-specified one now would
have to be un-shipped then.
"""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsDispatcherOrSupervisor, IsOfficer

from . import services
from .models import PanicEvent
from .serializers import (
    ActivePanicSerializer,
    PanicEventSerializer,
    PanicResolveSerializer,
    PanicTriggerSerializer,
)


class PanicActionMixin:
    """
    Shared plumbing for the two transition endpoints, same shape as
    MissionActionMixin: load the event, call one function in services, return
    the event. One place translates rule violations, so a refusal reports the
    same way from every endpoint.
    """

    def get_event(self, event_id: int) -> PanicEvent:
        return get_object_or_404(PanicEvent, pk=event_id)

    def run(self, fn, *args, **kwargs) -> Response:
        try:
            event = fn(*args, **kwargs)
        except services.PanicPermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.PanicError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PanicEventSerializer(event).data)


class PanicTriggerView(APIView):
    """
    POST /api/v1/panic/ — §4.7 raise the alarm.

    201 for a new alert, 200 when one was already active. Idempotent, because
    an officer in trouble taps more than once and a phone on a bad connection
    retries; neither may raise a second alert.
    """

    permission_classes = [IsAuthenticated, IsOfficer]
    serializer_class = PanicTriggerSerializer

    @extend_schema(
        request=PanicTriggerSerializer,
        responses={201: PanicEventSerializer, 200: PanicEventSerializer},
        examples=[
            OpenApiExample(
                "Panic with a good fix",
                value={
                    "latitude": 34.436700,
                    "longitude": 35.849700,
                    "accuracy_m": 12.5,
                    "battery_level": 38,
                },
                request_only=True,
            ),
            OpenApiExample(
                "Position only",
                value={"latitude": 34.436700, "longitude": 35.849700},
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        serializer = PanicTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            event, created = services.trigger_panic(request.user, **serializer.validated_data)
        except services.PanicError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            PanicEventSerializer(event).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PanicCancelView(APIView, PanicActionMixin):
    """
    POST /api/v1/panic/{id}/cancel/ — §4.7, the officer withdraws it.

    Own alert only, and only inside the grace window. Past that the dispatcher
    has already seen it and may be responding, so it takes a resolve.
    """

    permission_classes = [IsAuthenticated, IsOfficer]

    @extend_schema(request=None, responses=PanicEventSerializer)
    def post(self, request, event_id: int):
        return self.run(services.cancel_panic, self.get_event(event_id), request.user)


class PanicResolveView(APIView, PanicActionMixin):
    """POST /api/v1/panic/{id}/resolve/ — §4.7, a dispatcher closes it."""

    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]
    serializer_class = PanicResolveSerializer

    @extend_schema(
        request=PanicResolveSerializer,
        responses=PanicEventSerializer,
        examples=[
            OpenApiExample(
                "Closed after contact",
                value={"notes": "Reached the officer by radio; false alarm, no unit sent."},
                request_only=True,
            )
        ],
    )
    def post(self, request, event_id: int):
        serializer = PanicResolveSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        return self.run(
            services.resolve_panic,
            self.get_event(event_id),
            request.user,
            notes=serializer.validated_data.get("notes", ""),
        )


class ActivePanicView(APIView):
    """
    GET /api/v1/panic/active/ — §4.6, the red pulsing marker.

    Only alerts still open. Cancelled and resolved ones are kept forever as
    audit records but must never reappear on the map.
    """

    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]
    serializer_class = ActivePanicSerializer

    @extend_schema(responses=ActivePanicSerializer(many=True))
    def get(self, request):
        events = (
            PanicEvent.objects.filter(status=PanicEvent.Status.ACTIVE)
            .select_related("officer")
            .order_by("triggered_at")  # oldest first; it has been waiting longest
        )
        return Response(ActivePanicSerializer(events, many=True).data)
