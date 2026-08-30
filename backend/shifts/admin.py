from django.contrib import admin

from .models import LocationPing, Shift


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ["officer", "status", "started_at", "ended_at"]
    list_filter = ["status"]


@admin.register(LocationPing)
class LocationPingAdmin(admin.ModelAdmin):
    list_display = [
        "officer",
        "recorded_at",
        "received_at",
        "latitude",
        "longitude",
        "accuracy_m",
        "is_offline_sync",
    ]
    list_filter = ["network_type", "is_offline_sync"]
