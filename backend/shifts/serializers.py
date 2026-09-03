from rest_framework import serializers
 
from core.serializers import OfficerBriefSerializer
 
from .models import LocationPing, Shift
 
 
class LocationPingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationPing
        fields = [
            "latitude",
            "longitude",
            "accuracy_m",
            "battery_level",
            "network_type",
            "recorded_at",
            "received_at",
            "is_offline_sync",
        ]
 
 
class ShiftBoundarySerializer(serializers.Serializer):
    """Optional position sent with Start Shift and End Shift."""
 
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
 
    def validate(self, attrs):
        has_lat = attrs.get("latitude") is not None
        has_lng = attrs.get("longitude") is not None
        if has_lat != has_lng:
            raise serializers.ValidationError("Send both latitude and longitude, or neither.")
        return attrs
 
 
class LocationPingUploadSerializer(serializers.Serializer):
    """One ping in a batch upload. Deliberately not a ModelSerializer: the
    unique constraint on client_uuid must be resolved by the database during
    bulk_create, not by a per-row uniqueness query."""
 
    client_uuid = serializers.UUIDField()
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = serializers.FloatField(required=False, allow_null=True)
    recorded_at = serializers.DateTimeField()
    battery_level = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=100
    )
    network_type = serializers.ChoiceField(
        choices=LocationPing.NetworkType.choices,
        required=False,
        default=LocationPing.NetworkType.UNKNOWN,
    )
    is_offline_sync = serializers.BooleanField(required=False, default=False)
 
 
class BulkLocationPingSerializer(serializers.Serializer):
    # One request per ping drains the battery §13 warns about. Cap the batch so
    # an 8-hour offline queue arrives in several requests, not one huge one.
    pings = serializers.ListField(
        child=LocationPingUploadSerializer(), allow_empty=False, max_length=500
    )
 
 
class ShiftSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.IntegerField(read_only=True)
 
    class Meta:
        model = Shift
        fields = [
            "id",
            "status",
            "started_at",
            "ended_at",
            "duration_seconds",
            "start_latitude",
            "start_longitude",
            "end_latitude",
            "end_longitude",
        ]
 
 
class CurrentMissionSerializer(serializers.Serializer):
    """
    The mission an officer is on, as the map row carries it.
 
    Four fields on purpose: the drawer calls GET /missions/{id}/ for the full
    record and its timeline, so widening this would ship the same data twice.
    """
 
    id = serializers.IntegerField()
    title = serializers.CharField()
    priority = serializers.CharField()
    status = serializers.CharField()
 
 
class ActiveOfficerSerializer(serializers.Serializer):
    """
    The contract for GET /shifts/active/ — the shape web builds against.
    Agreed before either side codes; see docs/CONTRACT-shifts-active.md.
    """
 
    officer = OfficerBriefSerializer()
    status = serializers.CharField()
    shift_started_at = serializers.DateTimeField()
    shift_duration_seconds = serializers.IntegerField()
    distance_covered_m = serializers.IntegerField()
    latest_ping = LocationPingSerializer(allow_null=True)
    current_mission = CurrentMissionSerializer(allow_null=True)
 