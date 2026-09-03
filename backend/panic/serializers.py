from rest_framework import serializers

from core.serializers import OfficerBriefSerializer

from .models import PanicEvent


class PanicTriggerSerializer(serializers.Serializer):
    """
    POST /api/v1/panic/ body.

    Position is required, unlike the optional one on Start Shift: an alert the
    dispatcher cannot put on the map is not an alert. Battery and accuracy are
    optional because the phone may not have them, and waiting for a better GPS
    fix before sending is the wrong trade for this button.
    """

    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = serializers.FloatField(required=False, allow_null=True)
    battery_level = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=100
    )


class PanicResolveSerializer(serializers.Serializer):
    """POST /api/v1/panic/{id}/resolve/ body. What happened, in the closer's words."""

    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="What the alert turned out to be and how it was handled.",
    )


class PanicEventSerializer(serializers.ModelSerializer):
    """
    One alert in full — what trigger, cancel, and resolve all return.

    `resolved_by` is expanded rather than left as an id so the dashboard can
    show who closed it without a second request.
    """

    resolved_by = OfficerBriefSerializer(read_only=True, allow_null=True)

    class Meta:
        model = PanicEvent
        fields = [
            "id",
            "shift",
            "status",
            "latitude",
            "longitude",
            "accuracy_m",
            "battery_level",
            "triggered_at",
            "cancelled_at",
            "resolved_at",
            "resolved_by",
            "notes",
        ]


class ActivePanicSerializer(serializers.ModelSerializer):
    """
    The contract for GET /api/v1/panic/active/ — what feeds the red pulsing
    marker in §4.6.

    Deliberately narrow: name, badge, and where they are. The outcome columns
    are all empty on an active alert, so sending them would be noise on an
    endpoint every open dashboard polls.
    """

    officer = OfficerBriefSerializer(read_only=True)

    class Meta:
        model = PanicEvent
        fields = [
            "id",
            "officer",
            "shift",
            "latitude",
            "longitude",
            "accuracy_m",
            "battery_level",
            "triggered_at",
        ]
