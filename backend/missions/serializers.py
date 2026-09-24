from rest_framework import serializers

from core.serializers import OfficerBriefSerializer

from .models import Mission, MissionEvent, MissionPhoto


class MissionPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MissionPhoto
        fields = [
            "id",
            "client_uuid",
            "image",
            "captured_latitude",
            "captured_longitude",
            "captured_at",
            "uploaded_at",
        ]


class MissionEventSerializer(serializers.ModelSerializer):
    actor = OfficerBriefSerializer(read_only=True)

    class Meta:
        model = MissionEvent
        fields = ["id", "event_type", "actor", "created_at", "metadata"]


class MissionListSerializer(serializers.ModelSerializer):
    """
    The list row. Deliberately without events and photos: the mission list is
    polled alongside the map, and dragging every event of every mission into
    that response would grow without bound over a shift.
    """

    assigned_to = OfficerBriefSerializer(many=True, read_only=True)

    # The district the mission is in, worked out from its position when it was
    # created. Null when it fell outside every area. `address` is what the
    # dispatcher typed; this is what the reports group by, so a client can show
    # either without guessing which district a free-text address means.
    area = serializers.CharField(source="area.name", read_only=True, default=None)
    area_id = serializers.IntegerField(read_only=True, allow_null=True)

    is_overdue = serializers.SerializerMethodField()
    awaiting_acknowledgement = serializers.SerializerMethodField()
    duration_seconds = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Mission
        fields = [
            "id",
            "title",
            "priority",
            "category",
            "status",
            "latitude",
            "longitude",
            "address",
            "area",
            "area_id",
            "assigned_to",
            "deadline",
            "created_at",
            "assigned_at",
            "duration_seconds",
            "is_overdue",
            "awaiting_acknowledgement",
        ]

    def get_is_overdue(self, obj) -> bool:
        from django.utils import timezone

        return bool(obj.deadline and obj.is_open and obj.deadline < timezone.now())

    def get_awaiting_acknowledgement(self, obj) -> bool:
        """The dashboard highlights these. Set by the sweep, not here."""
        return obj.status == Mission.Status.ASSIGNED and obj.ack_alert_sent_at is not None


class MissionDetailSerializer(MissionListSerializer):
    """The drawer. Carries the full lifecycle timeline."""

    created_by = OfficerBriefSerializer(read_only=True)
    events = MissionEventSerializer(many=True, read_only=True)
    photos = MissionPhotoSerializer(many=True, read_only=True)

    class Meta(MissionListSerializer.Meta):
        fields = MissionListSerializer.Meta.fields + [
            "description",
            "created_by",
            "acknowledged_at",
            "started_at",
            "completed_at",
            "cancelled_at",
            "started_latitude",
            "started_longitude",
            "completed_latitude",
            "completed_longitude",
            "notes",
            "cancellation_reason",
            "ack_alert_sent_at",
            "events",
            "photos",
        ]


class MissionCreateSerializer(serializers.Serializer):
    """Dispatcher creates a mission, optionally assigning it at once."""

    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(
        choices=Mission.Priority.choices, default=Mission.Priority.MEDIUM
    )
    category = serializers.ChoiceField(
        choices=Mission.Category.choices,
        default=Mission.Category.MUNICIPAL,
        help_text="Municipal, Sanitation, Traffic, or Infrastructure. Optional.",
    )
    deadline = serializers.DateTimeField(required=False, allow_null=True)
    assigned_to_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="Officers to assign immediately. Optional.",
    )


class AssignSerializer(serializers.Serializer):
    officer_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(
        help_text="Required. Stored on the mission and in the timeline."
    )


class PositionSerializer(serializers.Serializer):
    """Where the officer was when they started or completed."""

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


class CompleteSerializer(PositionSerializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()


class PhotoUploadSerializer(serializers.Serializer):
    """
    Multipart upload. `client_uuid` is generated on the phone before the row
    enters the upload queue, so a retry is a no-op rather than a second copy.
    """

    client_uuid = serializers.UUIDField()
    image = serializers.FileField()
    captured_latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    captured_longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    captured_at = serializers.DateTimeField(required=False, allow_null=True)