"""
users/admin.py

Gives you a working user-management UI immediately — useful as a Phase 2
fallback if the React dashboard slips, and for creating demo accounts.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from users.models import User, DeviceToken, PasswordResetCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("badge_number", "full_name", "username", "role", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("full_name", "badge_number", "username", "phone")
    ordering = ("full_name",)

    # Rebuilt because AbstractUser's default fieldsets reference first_name,
    # last_name, and email, which we removed from the model.
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Identity", {"fields": ("full_name", "badge_number", "phone")}),
        ("Role", {"fields": ("role", "preferred_language")}),
        ("Status", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Audit", {"fields": ("created_by", "last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "password1",
                    "password2",
                    "full_name",
                    "badge_number",
                    "phone",
                    "role",
                ),
            },
        ),
    )
    readonly_fields = ("last_login", "date_joined")


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "device_model", "is_active", "last_seen_at")
    list_filter = ("platform", "is_active")
    search_fields = ("user__full_name", "user__badge_number", "token")


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "issued_by", "created_at", "expires_at", "used_at")
    readonly_fields = ("code_hash",)
    search_fields = ("user__full_name", "user__badge_number")