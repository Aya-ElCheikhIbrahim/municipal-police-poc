"""
authentication/serializers.py

Login adds a "user" object to the token response so the client doesn't need
a second call. Password reset serializers only validate input shape and the
existence/state of the officer being reset — the actual code generation and
checking lives in services.py.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from users.models import User


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {
            "id": self.user.id,
            "full_name": self.user.full_name,
            "badge_number": self.user.badge_number,
            "role": self.user.role,
            "preferred_language": self.user.preferred_language,
        }
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    badge_number = serializers.CharField()

    def validate_badge_number(self, value):
        try:
            user = User.objects.get(badge_number=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("No user with that badge number.")
        if not user.is_active:
            raise serializers.ValidationError("This user account is not active.")
        self.user = user
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    badge_number = serializers.CharField()
    code = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True)
