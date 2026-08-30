from django.contrib import admin

# Register your models here.
from django.contrib import admin
 
from .models import Mission, MissionEvent, MissionPhoto
 
 
class MissionEventInline(admin.TabularInline):
    model = MissionEvent
    extra = 0
    readonly_fields = ["event_type", "actor", "created_at", "metadata"]
    can_delete = False  # the trail is append-only
 
    def has_add_permission(self, request, obj=None):
        return False
 
 
class MissionPhotoInline(admin.TabularInline):
    model = MissionPhoto
    extra = 0
    readonly_fields = ["client_uuid", "uploaded_by", "uploaded_at", "captured_at"]
 
 
@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "priority", "status", "assigned_to", "created_at", "deadline"]
    list_filter = ["status", "priority"]
    search_fields = ["title", "address"]
    date_hierarchy = "created_at"
    inlines = [MissionEventInline, MissionPhotoInline]
 
    # Status is driven by services.py; editing it here would skip the machine
    # and leave the timestamps and the event trail inconsistent with it.
    readonly_fields = [
        "status",
        "created_at",
        "assigned_at",
        "acknowledged_at",
        "started_at",
        "completed_at",
        "cancelled_at",
        "ack_alert_sent_at",
    ]
 
 
@admin.register(MissionEvent)
class MissionEventAdmin(admin.ModelAdmin):
    list_display = ["mission", "event_type", "actor", "created_at"]
    list_filter = ["event_type"]
 
    def has_change_permission(self, request, obj=None):
        return False
 