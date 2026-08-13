"""
users/serializers.py


Converst User objects to JSON and validates incoming JSON.
Seperate serializers per operation so each one exposes only the fields thaat operation is allowed to touch
"""


from django.contrib.auth.password_validation import  validate_password
from rest_framework import serializers
from users.models import User, DeviceToken

class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model=User
        fields = [
            "id",
            "username",
            "full_name",
            "badge_number",
            "phone",
            "role",
            "preferred_language",
            "is_active",
            "created_at",
            "last_login"
        ]
        read_only_fields=["id","created_at","last_login"]

class UserCreateSerializer(serializers.ModelSerializer):
    """"Supervisor creates an account only (in section 4: no self registration)"""
    password = serializers.CharField(write_only=True, min_length=8)
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "full_name",
            "badge_number",
            "phone",
            "role",
            "preferred_language",
        ]
    def validate_password(self, value):
        validate_password(value)
        return value
    def create(self, validate_data):
        password = validate_data.pop ("password")
        user = User (**validate_data)
        user.set_password(password) #hashed with Argon2
        user.save()
        return user

class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "full_name",
            "phone",
            "role",
            "preferred_language",
            "is_active"
        ]

class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "preferred_language",
            "phone"
        ]

class DeviceTokenSerializer(serializers.ModelSerializer):

    class Meta:
        model = DeviceToken
        fields = [
            "id",
            "token",
            "platform",
            "device_model",
            "app_version"
        ]
    def create(self, validated_data):
        user = self.context["request"].user
        token, _ = DeviceToken.objects.update_or_create(
            token=validated_data.pop("token"),
            defaults={"user": user, "is_active": True, **validated_data},
        )
        return token