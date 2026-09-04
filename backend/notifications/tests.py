"""
notifications/tests.py

Two layers, matching the convention in missions/tests.py:
  - service tests exercise notifications.services directly
  - API tests go through APIClient with force_authenticate

The security property under test throughout is that a notification is
readable only by its recipient, and that a foreign notification is
indistinguishable from a missing one (404, never 403 — a 403 would confirm
the row exists).

Note on response shape: the notifications list is a ListAPIView, so it picks
up the project-wide PageNumberPagination (PAGE_SIZE 25). Responses are
{count, next, previous, results}, unlike the missions endpoints, which are
plain APIViews and return bare arrays. Hence .json()["results"] below.
"""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from missions.models import Mission
from notifications import services
from notifications.models import Notification, NotificationType
from users.models import Role, User


def make_user(username, role=Role.OFFICER, **extra):
    return User.objects.create_user(
        username=username,
        password="testpass123",
        full_name=f"Test {username}",
        badge_number=f"B-{username}",
        role=role,
        **extra,
    )


class NotificationTestCase(TestCase):
    def setUp(self):
        self.officer = make_user("off1")
        self.other_officer = make_user("off2")
        self.dispatcher = make_user("disp1", role=Role.DISPATCHER)
        self.supervisor = make_user("sup1", role=Role.SUPERVISOR)

    def make_mission(self, **kwargs):
        defaults = {
            "title": "Illegal parking on Rue Tall",
            "description": "Vehicle blocking the junction.",
            "created_by": self.dispatcher,
            "latitude": 34.44,
            "longitude": 35.85,
        }
        defaults.update(kwargs)
        return Mission.objects.create(**defaults)

    def make_notification(self, recipient=None, **kwargs):
        defaults = {
            "recipient": recipient or self.officer,
            "notification_type": NotificationType.MISSION_ASSIGNED,
            "title": "New mission assigned",
            "body": "Something happened.",
        }
        defaults.update(kwargs)
        return Notification.objects.create(**defaults)

    def feed(self):
        """The paginated list endpoint's rows, unwrapped."""
        return self.client.get("/api/v1/notifications/").json()["results"]


class CreationTests(NotificationTestCase):
    def test_assignment_notifies_the_assigned_officer(self):
        mission = self.make_mission(assigned_to=self.officer)
        notification = services.notify_mission_assigned(mission, self.officer)

        self.assertEqual(notification.recipient, self.officer)
        self.assertEqual(
            notification.notification_type, NotificationType.MISSION_ASSIGNED
        )
        self.assertEqual(notification.related_mission, mission)
        self.assertFalse(notification.is_read)

    def test_cancellation_carries_the_reason(self):
        mission = self.make_mission(assigned_to=self.officer)
        notification = services.notify_mission_cancelled(
            mission, self.officer, reason="Resolved by another unit."
        )

        self.assertIn("Resolved by another unit.", notification.body)

    def test_cancelling_an_unassigned_mission_notifies_nobody(self):
        """4.4 allows cancelling before assignment - there is no recipient."""
        mission = self.make_mission()
        result = services.notify_mission_cancelled(mission, None, reason="Duplicate.")

        self.assertIsNone(result)
        self.assertEqual(Notification.objects.count(), 0)

    def test_unacknowledged_sweep_fans_out_to_dispatchers_and_supervisors(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.notify_mission_unacknowledged(mission)

        recipients = set(
            Notification.objects.values_list("recipient_id", flat=True)
        )
        self.assertEqual(recipients, {self.dispatcher.id, self.supervisor.id})

    def test_unacknowledged_sweep_does_not_notify_officers(self):
        """4.9 puts this alert on the dashboard, not the officer's phone."""
        mission = self.make_mission(assigned_to=self.officer)
        services.notify_mission_unacknowledged(mission)

        self.assertFalse(
            Notification.objects.filter(recipient=self.officer).exists()
        )

    def test_unacknowledged_sweep_skips_inactive_users(self):
        self.dispatcher.is_active = False
        self.dispatcher.save(update_fields=["is_active"])
        mission = self.make_mission(assigned_to=self.officer)

        services.notify_mission_unacknowledged(mission)

        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(
            Notification.objects.first().recipient, self.supervisor
        )


class ReadStateTests(NotificationTestCase):
    def test_marking_read_sets_the_timestamp(self):
        notification = self.make_notification()
        services.mark_read(notification)

        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_marking_read_twice_does_not_move_the_timestamp(self):
        notification = self.make_notification()
        services.mark_read(notification)
        first_read_at = notification.read_at

        services.mark_read(notification)
        notification.refresh_from_db()

        self.assertEqual(notification.read_at, first_read_at)

    def test_mark_all_read_returns_the_number_changed(self):
        self.make_notification()
        self.make_notification()
        self.make_notification(is_read=True, read_at=timezone.now())

        self.assertEqual(services.mark_all_read(self.officer), 2)
        self.assertEqual(services.unread_count(self.officer), 0)

    def test_mark_all_read_leaves_other_users_alone(self):
        self.make_notification(recipient=self.other_officer)
        services.mark_all_read(self.officer)

        self.assertEqual(services.unread_count(self.other_officer), 1)


class ScopingTests(NotificationTestCase):
    def test_list_returns_only_the_users_own(self):
        self.make_notification()
        self.make_notification(recipient=self.other_officer)

        rows = services.list_for_user(self.officer)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].recipient, self.officer)

    def test_get_for_user_refuses_a_foreign_notification(self):
        foreign = self.make_notification(recipient=self.other_officer)

        self.assertIsNone(services.get_for_user(self.officer, foreign.pk))

    def test_unread_filter(self):
        self.make_notification()
        self.make_notification(is_read=True, read_at=timezone.now())

        self.assertEqual(len(services.list_for_user(self.officer, unread_only=True)), 1)

    def test_type_filter(self):
        self.make_notification()
        self.make_notification(
            notification_type=NotificationType.MISSION_CANCELLED
        )

        rows = services.list_for_user(
            self.officer, notification_type=NotificationType.MISSION_CANCELLED
        )
        self.assertEqual(len(rows), 1)


class ApiTests(NotificationTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()

    def test_anonymous_is_refused(self):
        response = self.client.get("/api/v1/notifications/")
        self.assertEqual(response.status_code, 401)

    def test_officer_sees_their_own_feed(self):
        self.make_notification()
        self.make_notification(recipient=self.other_officer)

        self.client.force_authenticate(self.officer)

        self.assertEqual(len(self.feed()), 1)

    def test_dispatcher_has_a_feed_too(self):
        """Notifications are per-recipient, not role-gated."""
        self.make_notification(recipient=self.dispatcher)

        self.client.force_authenticate(self.dispatcher)

        self.assertEqual(len(self.feed()), 1)

    def test_unread_count_endpoint(self):
        self.make_notification()
        self.make_notification()

        self.client.force_authenticate(self.officer)
        response = self.client.get("/api/v1/notifications/unread-count/")

        self.assertEqual(response.json()["unread_count"], 2)

    def test_marking_a_foreign_notification_returns_404_not_403(self):
        foreign = self.make_notification(recipient=self.other_officer)

        self.client.force_authenticate(self.officer)
        response = self.client.post(f"/api/v1/notifications/{foreign.pk}/read/")

        self.assertEqual(response.status_code, 404)
        foreign.refresh_from_db()
        self.assertFalse(foreign.is_read)

    def test_mark_all_read_endpoint(self):
        self.make_notification()
        self.make_notification()

        self.client.force_authenticate(self.officer)
        response = self.client.post("/api/v1/notifications/mark-all-read/")

        self.assertEqual(response.json()["marked_read"], 2)

    def test_feed_carries_mission_context(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.notify_mission_assigned(mission, self.officer)

        self.client.force_authenticate(self.officer)
        row = self.feed()[0]

        self.assertEqual(row["mission_id"], mission.id)
        self.assertEqual(row["mission_title"], mission.title)

    def test_feed_handles_a_notification_with_no_mission(self):
        """default=None on the serializer's mission fields is what saves this."""
        self.make_notification(
            notification_type=NotificationType.DISPATCHER_MESSAGE,
            related_mission=None,
        )

        self.client.force_authenticate(self.officer)
        row = self.feed()[0]

        self.assertIsNone(row["mission_id"])
        self.assertIsNone(row["mission_title"])
