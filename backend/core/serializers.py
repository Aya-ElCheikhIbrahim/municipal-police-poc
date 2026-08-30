from rest_framework import serializers

from .registry import DEFINITIONS


class SystemSettingSerializer(serializers.Serializer):
    """
    The settings object, flat rather than a list of key/value rows.

    Built from the registry so a new setting appears in the API docs the
    moment it is added to DEFINITIONS — no second place to update.

    Validation still happens in `registry.set_settings`; this exists so
    drf-spectacular can render a request body and so the docs show each
    field's bounds. Duplicating the checks here would give two sources of
    truth for the same rule.
    """

    def get_fields(self):
        return {
            key: serializers.IntegerField(
                required=False,
                min_value=definition.minimum,
                max_value=definition.maximum,
                help_text=definition.description,
            )
            for key, definition in DEFINITIONS.items()
        }