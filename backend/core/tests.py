from django.test import TestCase

# Create your tests here.
"""
Tests for the system settings registry.

`core_systemsetting` stores arbitrary JSON under a string key, so none of the
bounds in the requirements can be enforced by the database. Everything here
checks the Python layer that replaces those constraints.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import SystemSetting
from .registry import DEFINITIONS, SettingError, all_settings, get_setting, set_settings

User = get_user_model()


def make_user(username, role="officer", **extra):
    return User.objects.create_user(
        username=username,
        password="test-password",
        full_name=extra.pop("full_name", "اختبار"),
        badge_number=extra.pop("badge_number", username.upper()),
        role=role,
        **extra,
    )


class SystemSettingTests(TestCase):
    """Bounds live in the registry because the JSON column cannot hold them."""

    def test_defaults_match_the_requirements(self):
        self.assertEqual(get_setting("location_ping_interval_seconds"), 30)  # §4.3
        self.assertEqual(get_setting("mission_ack_timeout_minutes"), 5)  # §4.9
        self.assertEqual(get_setting("location_retention_days"), 90)  # §5

    def test_defaults_apply_with_no_rows_present(self):
        """A fresh database and a configured one behave identically."""
        self.assertEqual(SystemSetting.objects.count(), 0)
        self.assertEqual(len(all_settings()), len(DEFINITIONS))

    def test_ping_interval_bounds_are_enforced(self):
        """§4.3 — 10s to 120s. The JSON column cannot enforce this itself."""
        with self.assertRaises(SettingError):
            set_settings({"location_ping_interval_seconds": 2})
        with self.assertRaises(SettingError):
            set_settings({"location_ping_interval_seconds": 600})

        set_settings({"location_ping_interval_seconds": 60})
        self.assertEqual(get_setting("location_ping_interval_seconds"), 60)

    def test_unknown_keys_are_rejected(self):
        """Stops a typo becoming a silently ignored row nobody notices."""
        with self.assertRaises(SettingError):
            set_settings({"ping_interval": 30})

    def test_non_numeric_value_is_rejected(self):
        with self.assertRaises(SettingError):
            set_settings({"location_retention_days": "ninety"})

    def test_update_records_who_changed_it(self):
        supervisor = make_user("supervisor3", role="supervisor")
        set_settings({"mission_ack_timeout_minutes": 10}, actor=supervisor)
        row = SystemSetting.objects.get(key="mission_ack_timeout_minutes")
        self.assertEqual(row.updated_by, supervisor)
        self.assertEqual(row.value, 10)

    def test_patch_requires_supervisor(self):
        client = APIClient()
        client.force_authenticate(make_user("dispatcher2", role="dispatcher"))
        response = client.patch(
            "/api/v1/settings/", {"location_ping_interval_seconds": 60}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_officer_can_read_settings(self):
        """The app reads the ping interval when a shift starts."""
        client = APIClient()
        client.force_authenticate(make_user("officer7"))
        response = client.get("/api/v1/settings/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("location_ping_interval_seconds", response.json())