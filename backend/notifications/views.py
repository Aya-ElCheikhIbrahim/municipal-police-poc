"""
notifications/views.py

Thin views. All logic lives in services.py, per the project convention.

Scope: every endpoint here is scoped to request.user. A notification is
addressed to exactly one recipient (§4.7 fan-out creates one row each), so
there is no legitimate reason for any user to read or mutate another user's
row — the queryset filter is the enforcement, not a permission class.
"""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Notification
from .serializers import NotificationSerializer


@extend_schema(
    summary="List the current user's notifications",
    parameters=[
        OpenApiParameter(
            name="unread",
            description="Pass true to return only unread notifications.",
            required=False,
            type=bool,
        ),
        OpenApiParameter(
            name="type",
            description="Filter by notification_type.",
            required=False,
            type=str,
        ),
    ],
    responses=NotificationSerializer,
)
class NotificationListView(generics.ListAPIView):
    """GET /api/v1/notifications/"""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return services.list_for_user(
            user=self.request.user,
            unread_only=self.request.query_params.get("unread") == "true",
            notification_type=self.request.query_params.get("type"),
        )


@extend_schema(
    summary="Unread notification count for the current user",
    responses={200: {"type": "object", "properties": {"unread_count": {"type": "integer"}}}},
)
class NotificationUnreadCountView(APIView):
    """
    GET /api/v1/notifications/unread-count/

    Separate from the list endpoint because the dashboard badge polls this
    far more often than it opens the list — no reason to serialise rows the
    caller is going to discard.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"unread_count": services.unread_count(request.user)})


@extend_schema(
    summary="Mark one notification as read",
    request=None,
    responses=NotificationSerializer,
)
class NotificationMarkReadView(APIView):
    """POST /api/v1/notifications/{id}/read/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = services.get_for_user(user=request.user, pk=pk)
        if notification is None:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        services.mark_read(notification)
        return Response(NotificationSerializer(notification).data)


@extend_schema(
    summary="Mark all of the current user's notifications as read",
    request=None,
    responses={200: {"type": "object", "properties": {"marked_read": {"type": "integer"}}}},
)
class NotificationMarkAllReadView(APIView):
    """POST /api/v1/notifications/mark-all-read/"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({"marked_read": services.mark_all_read(request.user)})
