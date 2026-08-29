from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsSupervisor
from .registry import DEFINITIONS, SettingError, all_settings, set_settings


class SystemSettingView(APIView):
    """
    GET   /api/v1/settings/ — any signed-in user. The officer app reads the
                              ping interval from here when a shift starts.
    PATCH /api/v1/settings/ — supervisor only (§3). Partial update.

    Returns a flat object rather than a list of rows, so Android reads
    `response.location_ping_interval_seconds` without walking a key/value list.
    """

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT"):
            return [IsAuthenticated(), IsSupervisor()]
        return [IsAuthenticated()]

    def get(self, request):
        return Response(all_settings())

    def patch(self, request):
        if not isinstance(request.data, dict) or not request.data:
            return Response(
                {"detail": "Send an object of settings to change."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            updated = set_settings(request.data, actor=request.user)
        except SettingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(updated)


class SystemSettingSchemaView(APIView):
    """
    GET /api/v1/settings/schema/ — what each setting means and its bounds, so
    the supervisor screen can render inputs without hardcoding limits.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            [
                {
                    "key": key,
                    "description": d.description,
                    "default": d.default,
                    "minimum": d.minimum,
                    "maximum": d.maximum,
                }
                for key, d in DEFINITIONS.items()
            ]
        )