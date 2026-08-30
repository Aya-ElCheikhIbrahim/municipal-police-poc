from rest_framework import serializers
 
from .registry import DEFINITIONS
 
 
class OfficerBriefSerializer(serializers.Serializer):
    """
    The minimum identifying fields for a person, used by every app that has to
    label a row with an officer. Defined once in core: two apps declaring their
    own version produces two schema components with the same name, which makes
    the generated OpenAPI document wrong.
    """
 
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    badge_number = serializers.CharField()
 
 
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
 