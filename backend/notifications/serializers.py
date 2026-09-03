"""
notifications/serializers.py

Read-only throughout. Notifications are created by services.py in response to
domain events (§4.9) — never by a client POST — so there is nothing to
validate on the way in.
"""

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display",
        read_only=True,
    )

    # Flattened rather than nested: the feed needs enough mission context to
    # render a row and deep-link, not the whole mission. A nested serializer
    # here would pull the full payload on every poll.
    mission_id = serializers.IntegerField(
        source="related_mission_id",
        read_only=True,
    )
    mission_title = serializers.CharField(
        source="related_mission.title",
        read_only=True,
        default=None,
    )
    mission_status = serializers.CharField(
        source="related_mission.status",
        read_only=True,
        default=None,
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "notification_type_display",
            "title",
            "body",
            "mission_id",
            "mission_title",
            "mission_status",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields