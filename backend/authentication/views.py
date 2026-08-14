"""
authentication/views.py

HTTP layer for login, token refresh, and supervisor-issued password resets.
Validation lives in serializers.py, business logic in services.py.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import IsSupervisor
from users.models import User

from .serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)
from .services import confirm_reset, issue_reset_code


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]


class PasswordResetRequestView(APIView):
    permission_classes = [IsSupervisor]
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = issue_reset_code(serializer.user, issued_by=request.user)
        return Response({"code": code}, status=status.HTTP_201_CREATED)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            user = User.objects.get(badge_number=data["badge_number"])
        except User.DoesNotExist:
            return Response(
                {"detail": "No pending reset code for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            confirm_reset(user, data["code"], data["new_password"])
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)
