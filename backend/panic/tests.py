"""
Tests for the panic button (§4.7).

Small on purpose, like the shifts and missions suites — §10 asks for manual
test cases as a minimum. These cover the behaviours where a silent failure
either loses an audit record or puts a wrong marker on the dispatcher map.
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.registry import get_setting, invalidate_cache, set_settings
from shifts import services as shift_services

from . import services
from .models import PanicEvent

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


class PanicTestCase(TestCase):
    def setUp(self):
        self.officer = make_user("panic-off1")
        self.other_officer = make_user("panic-off2")
        self.dispatcher = make_user("panic-disp1", role="dispatcher")
        self.supervisor = make_user("panic-sup1", role="supervisor")
        self.client = APIClient()

        # The registry caches resolved settings for 60s in a process-wide
        # cache, but a TestCase rolls its rows back. Clear it either side of
        # every test so a value set in one cannot outlive its own database
        # state and change the grace window in the next.
        invalidate_cache()
        self.addCleanup(invalidate_cache)

    def on_duty(self, officer):
        shift, _ = shift_services.start_shift(officer)
        return shift

    def trigger(self, officer, **extra):
        self.on_duty(officer)
        event, _created = services.trigger_panic(
            officer,
            latitude=extra.pop("latitude", 34.436700),
            longitude=extra.pop("longitude", 35.849700),
            **extra,
        )
        return event

    def age_past_grace(self, event):
        """
        Push triggered_at back beyond the window. Set through the queryset
        because triggered_at is auto_now_add and a save() would not move it.
        """
        beyond = get_setting("panic_cancel_grace_seconds") + 5
        PanicEvent.objects.filter(pk=event.pk).update(
            triggered_at=timezone.now() - timezone.timedelta(seconds=beyond)
        )
        event.refresh_from_db()
        return event


class TriggerTests(PanicTestCase):
    def test_requires_an_active_shift(self):
        """Off duty means nothing is tracked (§4.2, §5), including this."""
        with self.assertRaises(services.PanicError):
            services.trigger_panic(self.officer, latitude=34.4367, longitude=35.8497)

    def test_no_active_shift_is_a_400(self):
        self.client.force_authenticate(self.officer)
        response = self.client.post(
            "/api/v1/panic/",
            {"latitude": 34.4367, "longitude": 35.8497},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(PanicEvent.objects.count(), 0)

    def test_triggering_twice_returns_the_same_event(self):
        """
        Two taps are one emergency. A second row would put a second red marker
        on the map for the same person.
        """
        first = self.trigger(self.officer)
        second, created = services.trigger_panic(
            self.officer, latitude=34.4400, longitude=35.8500
        )
        self.assertEqual(first.pk, second.pk)
        self.assertFalse(created)
        self.assertEqual(PanicEvent.objects.filter(officer=self.officer).count(), 1)

    def test_first_is_201_and_the_retry_is_200(self):
        self.on_duty(self.officer)
        self.client.force_authenticate(self.officer)
        body = {"latitude": 34.4367, "longitude": 35.8497, "battery_level": 38}

        first = self.client.post("/api/v1/panic/", body, format="json")
        second = self.client.post("/api/v1/panic/", body, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["id"], second.json()["id"])
        self.assertEqual(PanicEvent.objects.count(), 1)

    def test_alert_is_attached_to_the_current_shift(self):
        shift = self.on_duty(self.officer)
        event, _ = services.trigger_panic(
            self.officer, latitude=34.4367, longitude=35.8497
        )
        self.assertEqual(event.shift_id, shift.pk)
        self.assertEqual(event.status, PanicEvent.Status.ACTIVE)


class CancelTests(PanicTestCase):
    def test_cancel_inside_the_grace_window(self):
        event = self.trigger(self.officer)
        cancelled = services.cancel_panic(event, self.officer)
        self.assertEqual(cancelled.status, PanicEvent.Status.CANCELLED)
        self.assertIsNotNone(cancelled.cancelled_at)
        self.assertIsNone(cancelled.resolved_at)

    def test_cancel_outside_the_grace_window_is_refused(self):
        """The dispatcher has already seen it; only a resolve closes it now."""
        event = self.age_past_grace(self.trigger(self.officer))
        with self.assertRaises(services.PanicError):
            services.cancel_panic(event, self.officer)
        event.refresh_from_db()
        self.assertEqual(event.status, PanicEvent.Status.ACTIVE)

    def test_cancel_outside_the_grace_window_is_a_400(self):
        event = self.age_past_grace(self.trigger(self.officer))
        self.client.force_authenticate(self.officer)
        response = self.client.post(f"/api/v1/panic/{event.pk}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_an_officer_cannot_cancel_another_officers_alert(self):
        event = self.trigger(self.officer)
        with self.assertRaises(services.PanicPermissionError):
            services.cancel_panic(event, self.other_officer)

        self.client.force_authenticate(self.other_officer)
        response = self.client.post(f"/api/v1/panic/{event.pk}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        event.refresh_from_db()
        self.assertEqual(event.status, PanicEvent.Status.ACTIVE)

    def test_cancelling_frees_the_officer_to_raise_another(self):
        """The partial unique index covers active alerts only, not history."""
        first = self.trigger(self.officer)
        services.cancel_panic(first, self.officer)
        second, created = services.trigger_panic(
            self.officer, latitude=34.4400, longitude=35.8500
        )
        self.assertTrue(created)
        self.assertNotEqual(first.pk, second.pk)
        self.assertEqual(PanicEvent.objects.filter(officer=self.officer).count(), 2)


class GraceWindowSettingTests(PanicTestCase):
    """
    §4.7's 10 seconds is a default, not a constant. A supervisor changing
    panic_cancel_grace_seconds has to actually change the window an officer
    gets, or the setting is documentation rather than configuration.

    All three use the same seven-second-old alert, so what differs between
    them is only the setting.
    """

    SEVEN_SECONDS_OLD = 7

    def aged_alert(self):
        event = self.trigger(self.officer)
        PanicEvent.objects.filter(pk=event.pk).update(
            triggered_at=timezone.now()
            - timezone.timedelta(seconds=self.SEVEN_SECONDS_OLD)
        )
        event.refresh_from_db()
        return event

    def test_cancellable_at_the_default_of_ten(self):
        cancelled = services.cancel_panic(self.aged_alert(), self.officer)
        self.assertEqual(cancelled.status, PanicEvent.Status.CANCELLED)

    def test_lowering_the_setting_closes_the_window(self):
        set_settings({"panic_cancel_grace_seconds": 5})
        event = self.aged_alert()

        self.client.force_authenticate(self.officer)
        response = self.client.post(f"/api/v1/panic/{event.pk}/cancel/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("5-second", response.json()["detail"])
        event.refresh_from_db()
        self.assertEqual(event.status, PanicEvent.Status.ACTIVE)

    def test_raising_the_setting_widens_the_window(self):
        set_settings({"panic_cancel_grace_seconds": 60})
        event = self.trigger(self.officer)
        PanicEvent.objects.filter(pk=event.pk).update(
            triggered_at=timezone.now() - timezone.timedelta(seconds=45)
        )
        event.refresh_from_db()

        cancelled = services.cancel_panic(event, self.officer)
        self.assertEqual(cancelled.status, PanicEvent.Status.CANCELLED)


class ResolveTests(PanicTestCase):
    def test_dispatcher_resolves(self):
        event = self.trigger(self.officer)
        resolved = services.resolve_panic(event, self.dispatcher, notes="False alarm.")
        self.assertEqual(resolved.status, PanicEvent.Status.RESOLVED)
        self.assertEqual(resolved.resolved_by_id, self.dispatcher.pk)
        self.assertIsNotNone(resolved.resolved_at)
        self.assertIsNone(resolved.cancelled_at)

    def test_supervisor_resolves(self):
        event = self.trigger(self.officer)
        resolved = services.resolve_panic(event, self.supervisor)
        self.assertEqual(resolved.resolved_by_id, self.supervisor.pk)

    def test_an_officer_gets_403(self):
        event = self.trigger(self.officer)
        self.client.force_authenticate(self.officer)
        response = self.client.post(f"/api/v1/panic/{event.pk}/resolve/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        event.refresh_from_db()
        self.assertEqual(event.status, PanicEvent.Status.ACTIVE)

    def test_a_cancelled_alert_cannot_be_resolved(self):
        """
        Cancelled and resolved are different outcomes (SCHEMA.md). Turning one
        into the other after the fact would rewrite what happened.
        """
        event = self.trigger(self.officer)
        services.cancel_panic(event, self.officer)
        with self.assertRaises(services.PanicError):
            services.resolve_panic(event, self.dispatcher)
        event.refresh_from_db()
        self.assertEqual(event.status, PanicEvent.Status.CANCELLED)
        self.assertIsNone(event.resolved_at)

    def test_a_resolved_alert_cannot_be_cancelled(self):
        event = self.trigger(self.officer)
        services.resolve_panic(event, self.dispatcher)
        with self.assertRaises(services.PanicError):
            services.cancel_panic(event, self.officer)


class ConstraintTests(PanicTestCase):
    def test_resolved_without_a_resolver_is_rejected_by_the_database(self):
        """
        The check constraint, not the service, is what makes this impossible —
        a shell or an admin edit has to fail the same way an API call does.
        """
        event = self.trigger(self.officer)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PanicEvent.objects.filter(pk=event.pk).update(
                    status=PanicEvent.Status.RESOLVED,
                    resolved_at=timezone.now(),
                )

    def test_cancelled_without_a_timestamp_is_rejected_by_the_database(self):
        event = self.trigger(self.officer)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PanicEvent.objects.filter(pk=event.pk).update(
                    status=PanicEvent.Status.CANCELLED
                )

    def test_one_active_alert_per_officer(self):
        event = self.trigger(self.officer)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PanicEvent.objects.create(
                    officer=self.officer,
                    shift_id=event.shift_id,
                    latitude="34.440000",
                    longitude="35.850000",
                )


class ActiveFeedTests(PanicTestCase):
    def test_excludes_cancelled_and_resolved(self):
        still_open = self.trigger(self.officer)

        cancelled_by = make_user("panic-off3")
        services.cancel_panic(self.trigger(cancelled_by), cancelled_by)

        resolved_for = make_user("panic-off4")
        services.resolve_panic(self.trigger(resolved_for), self.dispatcher)

        self.client.force_authenticate(self.dispatcher)
        response = self.client.get("/api/v1/panic/active/")

        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual([row["id"] for row in rows], [still_open.pk])

    def test_carries_the_officer_name_badge_and_position(self):
        """§4.6 draws the red marker straight off this row."""
        event = self.trigger(self.officer, accuracy_m=12.5, battery_level=38)
        event.refresh_from_db()  # decimal(9,6) as stored, not as passed in
        self.client.force_authenticate(self.dispatcher)
        row = self.client.get("/api/v1/panic/active/").json()[0]

        self.assertEqual(row["officer"]["full_name"], self.officer.full_name)
        self.assertEqual(row["officer"]["badge_number"], self.officer.badge_number)
        self.assertEqual(row["latitude"], str(event.latitude))
        self.assertEqual(row["longitude"], str(event.longitude))
        self.assertEqual(row["battery_level"], 38)

    def test_an_officer_cannot_read_the_feed(self):
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.get("/api/v1/panic/active/").status_code, 403)
