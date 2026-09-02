from django.test import TestCase

# Create your tests here.
"""
Tests for the mission status machine.
 
The point of concentrating transitions in `services.py` is that every one
writes a `MissionEvent`. These tests check that the illegal paths are refused
and that the timeline is complete, because a missing event is invisible until
someone needs the audit trail and it is not there.
"""
 
import uuid
 
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
 
from core.registry import set_settings
 
from . import services
from .models import Mission, MissionEvent, MissionPhoto
 
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
 
 
class MissionTestCase(TestCase):
    def setUp(self):
        self.dispatcher = make_user("disp1", role="dispatcher")
        self.supervisor = make_user("sup1", role="supervisor")
        self.officer = make_user("off1")
        self.other_officer = make_user("off2")
 
    def make_mission(self, **kwargs):
        return services.create_mission(
            created_by=kwargs.pop("created_by", self.dispatcher),
            title=kwargs.pop("title", "Traffic obstruction"),
            latitude=kwargs.pop("latitude", 34.4367),
            longitude=kwargs.pop("longitude", 35.8497),
            **kwargs,
        )
 
    def event_types(self, mission):
        return list(mission.events.order_by("created_at").values_list("event_type", flat=True))
 
 
class CreationTests(MissionTestCase):
    def test_created_unassigned(self):
        mission = self.make_mission()
        self.assertEqual(mission.status, Mission.Status.NEW)
        self.assertIsNone(mission.assigned_to)
        self.assertEqual(self.event_types(mission), ["created"])
 
    def test_created_and_assigned_in_one_step(self):
        mission = self.make_mission(assigned_to=self.officer)
        self.assertEqual(mission.status, Mission.Status.ASSIGNED)
        self.assertIsNotNone(mission.assigned_at)
        self.assertEqual(self.event_types(mission), ["created", "assigned"])
 
    def test_cannot_assign_to_a_dispatcher(self):
        """Only officers work missions."""
        with self.assertRaises(services.MissionError):
            self.make_mission(assigned_to=self.dispatcher)
 
 
class TransitionTests(MissionTestCase):
    def test_full_lifecycle_writes_every_event(self):
        """§4.6's drawer shows a timeline; it can only show what was recorded."""
        mission = self.make_mission(assigned_to=self.officer)
        services.acknowledge_mission(mission, officer=self.officer)
        services.start_mission(mission, officer=self.officer, latitude=34.44, longitude=35.85)
        services.complete_mission(
            mission, officer=self.officer, latitude=34.45, longitude=35.85, notes="Vehicle removed."
        )
 
        mission.refresh_from_db()
        self.assertEqual(mission.status, Mission.Status.COMPLETED)
        self.assertEqual(
            self.event_types(mission),
            ["created", "assigned", "acknowledged", "started", "completed"],
        )
        for field in ["assigned_at", "acknowledged_at", "started_at", "completed_at"]:
            self.assertIsNotNone(getattr(mission, field), f"{field} was not set")
 
    def test_cannot_start_before_acknowledging(self):
        mission = self.make_mission(assigned_to=self.officer)
        with self.assertRaises(services.MissionError):
            services.start_mission(mission, officer=self.officer)
 
    def test_cannot_complete_before_starting(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.acknowledge_mission(mission, officer=self.officer)
        with self.assertRaises(services.MissionError):
            services.complete_mission(mission, officer=self.officer)
 
    def test_cannot_acknowledge_twice(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.acknowledge_mission(mission, officer=self.officer)
        with self.assertRaises(services.MissionError):
            services.acknowledge_mission(mission, officer=self.officer)
 
    def test_another_officer_cannot_act_on_it(self):
        mission = self.make_mission(assigned_to=self.officer)
        with self.assertRaises(services.MissionPermissionError):
            services.acknowledge_mission(mission, officer=self.other_officer)
 
    def test_completed_mission_cannot_be_cancelled(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.acknowledge_mission(mission, officer=self.officer)
        services.start_mission(mission, officer=self.officer)
        services.complete_mission(mission, officer=self.officer)
        with self.assertRaises(services.MissionError):
            services.cancel_mission(mission, actor=self.dispatcher, reason="changed my mind")
 
    def test_start_and_complete_positions_are_recorded(self):
        """Where the officer actually was, not where the mission is."""
        mission = self.make_mission(assigned_to=self.officer)
        services.acknowledge_mission(mission, officer=self.officer)
        services.start_mission(mission, officer=self.officer, latitude=34.44, longitude=35.85)
        services.complete_mission(mission, officer=self.officer, latitude=34.45, longitude=35.86)
 
        mission.refresh_from_db()
        self.assertIsNotNone(mission.started_latitude)
        self.assertIsNotNone(mission.completed_latitude)
        self.assertNotEqual(mission.started_latitude, mission.completed_latitude)
 
 
class ReassignmentTests(MissionTestCase):
    def test_reassign_before_acknowledgement_is_allowed(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.reassign_mission(mission, officer=self.other_officer, actor=self.dispatcher)
 
        mission.refresh_from_db()
        self.assertEqual(mission.assigned_to, self.other_officer)
        self.assertEqual(self.event_types(mission), ["created", "assigned", "reassigned"])
 
    def test_reassignment_records_the_previous_officer(self):
        """Otherwise the trail cannot answer who it was taken from."""
        mission = self.make_mission(assigned_to=self.officer)
        services.reassign_mission(mission, officer=self.other_officer, actor=self.dispatcher)
 
        event = mission.events.get(event_type="reassigned")
        self.assertEqual(event.metadata["previous_officer_id"], self.officer.id)
        self.assertEqual(event.metadata["officer_id"], self.other_officer.id)
 
    def test_reassign_after_acknowledgement_is_refused(self):
        """The officer may already be driving to it. Cancel with a reason instead."""
        mission = self.make_mission(assigned_to=self.officer)
        services.acknowledge_mission(mission, officer=self.officer)
        with self.assertRaises(services.MissionError):
            services.reassign_mission(mission, officer=self.other_officer, actor=self.dispatcher)
 
    def test_reassignment_resets_the_acknowledgement_clock(self):
        mission = self.make_mission(assigned_to=self.officer)
        mission.ack_alert_sent_at = timezone.now()
        mission.save(update_fields=["ack_alert_sent_at"])
 
        services.reassign_mission(mission, officer=self.other_officer, actor=self.dispatcher)
        mission.refresh_from_db()
        self.assertIsNone(mission.ack_alert_sent_at)
 
 
class CancellationTests(MissionTestCase):
    def test_cancel_requires_a_reason(self):
        mission = self.make_mission(assigned_to=self.officer)
        with self.assertRaises(services.MissionError):
            services.cancel_mission(mission, actor=self.dispatcher, reason="   ")
 
    def test_cancel_stores_the_reason_on_the_mission_and_the_event(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.cancel_mission(mission, actor=self.supervisor, reason="Duplicate of #12.")
 
        mission.refresh_from_db()
        self.assertEqual(mission.status, Mission.Status.CANCELLED)
        self.assertEqual(mission.cancellation_reason, "Duplicate of #12.")
        self.assertEqual(mission.events.get(event_type="cancelled").metadata["reason"], "Duplicate of #12.")
 
    def test_database_refuses_a_cancelled_mission_with_no_reason(self):
        """Belt and braces: the constraint holds even from a shell."""
        mission = self.make_mission(assigned_to=self.officer)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Mission.objects.filter(pk=mission.pk).update(status="cancelled")
 
 
class PhotoTests(MissionTestCase):
    def _image(self):
        return SimpleUploadedFile("evidence.jpg", b"not-a-real-jpeg", content_type="image/jpeg")
 
    def test_photo_is_attached_and_logged(self):
        mission = self.make_mission(assigned_to=self.officer)
        photo, created = services.add_photo(
            mission, officer=self.officer, client_uuid=uuid.uuid4(), image=self._image()
        )
        self.assertTrue(created)
        self.assertIn("photo_added", self.event_types(mission))
 
    def test_reupload_of_the_same_photo_is_a_noop(self):
        """A retry over a bad connection must not create a second copy."""
        mission = self.make_mission(assigned_to=self.officer)
        shared = uuid.uuid4()
 
        services.add_photo(mission, officer=self.officer, client_uuid=shared, image=self._image())
        photo, created = services.add_photo(
            mission, officer=self.officer, client_uuid=shared, image=self._image()
        )
 
        self.assertFalse(created)
        self.assertEqual(MissionPhoto.objects.count(), 1)
 
    def test_another_officer_cannot_attach_a_photo(self):
        mission = self.make_mission(assigned_to=self.officer)
        with self.assertRaises(services.MissionPermissionError):
            services.add_photo(
                mission,
                officer=self.other_officer,
                client_uuid=uuid.uuid4(),
                image=self._image(),
            )
 
 
class UnacknowledgedSweepTests(MissionTestCase):
    def test_flags_only_missions_past_the_timeout(self):
        """§4.9 — the dashboard warns when nobody has picked it up."""
        set_settings({"mission_ack_timeout_minutes": 5})
 
        stale = self.make_mission(assigned_to=self.officer)
        Mission.objects.filter(pk=stale.pk).update(
            assigned_at=timezone.now() - timezone.timedelta(minutes=10)
        )
        fresh = self.make_mission(assigned_to=self.other_officer)
 
        flagged = services.flag_unacknowledged()
 
        self.assertEqual([m.pk for m in flagged], [stale.pk])
        fresh.refresh_from_db()
        self.assertIsNone(fresh.ack_alert_sent_at)
 
    def test_sweep_flags_each_mission_only_once(self):
        """Otherwise every dashboard poll raises the same alert again."""
        set_settings({"mission_ack_timeout_minutes": 5})
        mission = self.make_mission(assigned_to=self.officer)
        Mission.objects.filter(pk=mission.pk).update(
            assigned_at=timezone.now() - timezone.timedelta(minutes=10)
        )
 
        self.assertEqual(len(services.flag_unacknowledged()), 1)
        self.assertEqual(len(services.flag_unacknowledged()), 0)
        self.assertEqual(
            MissionEvent.objects.filter(event_type="ack_alert_sent").count(), 1
        )
 
    def test_acknowledged_missions_are_never_flagged(self):
        set_settings({"mission_ack_timeout_minutes": 5})
        mission = self.make_mission(assigned_to=self.officer)
        Mission.objects.filter(pk=mission.pk).update(
            assigned_at=timezone.now() - timezone.timedelta(minutes=10)
        )
        services.acknowledge_mission(mission, officer=self.officer)
 
        self.assertEqual(services.flag_unacknowledged(), [])
 
 
class ApiPermissionTests(MissionTestCase):
    """§3 and §5 — enforced server-side, never only in the UI."""
 
    def setUp(self):
        super().setUp()
        self.client = APIClient()
 
    def test_officer_cannot_create_a_mission(self):
        self.client.force_authenticate(self.officer)
        response = self.client.post(
            "/api/v1/missions/",
            {"title": "x", "latitude": "34.4", "longitude": "35.8"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
 
    def test_dispatcher_can_create_a_mission(self):
        self.client.force_authenticate(self.dispatcher)
        response = self.client.post(
            "/api/v1/missions/",
            {
                "title": "Traffic obstruction",
                "latitude": "34.436700",
                "longitude": "35.849700",
                "priority": "high",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "new")
 
    def test_officer_list_shows_only_their_own_missions(self):
        """§5 — an officer sees their own work, not the whole city's."""
        self.make_mission(assigned_to=self.officer)
        self.make_mission(assigned_to=self.other_officer)
 
        self.client.force_authenticate(self.officer)
        rows = self.client.get("/api/v1/missions/").json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["assigned_to"]["id"], self.officer.id)
 
    def test_dispatcher_list_shows_everything(self):
        self.make_mission(assigned_to=self.officer)
        self.make_mission(assigned_to=self.other_officer)
 
        self.client.force_authenticate(self.dispatcher)
        self.assertEqual(len(self.client.get("/api/v1/missions/").json()), 2)
 
    def test_officer_cannot_open_someone_elses_mission(self):
        mission = self.make_mission(assigned_to=self.other_officer)
        self.client.force_authenticate(self.officer)
        response = self.client.get(f"/api/v1/missions/{mission.pk}/")
        self.assertEqual(response.status_code, 403)
 
    def test_officer_cannot_cancel(self):
        mission = self.make_mission(assigned_to=self.officer)
        self.client.force_authenticate(self.officer)
        response = self.client.post(
            f"/api/v1/missions/{mission.pk}/cancel/", {"reason": "nope"}, format="json"
        )
        self.assertEqual(response.status_code, 403)
 
    def test_illegal_transition_returns_400_not_500(self):
        mission = self.make_mission(assigned_to=self.officer)
        self.client.force_authenticate(self.officer)
        response = self.client.post(f"/api/v1/missions/{mission.pk}/start/", {}, format="json")
        self.assertEqual(response.status_code, 400)
 
    def test_acting_on_another_officers_mission_returns_403(self):
        mission = self.make_mission(assigned_to=self.other_officer)
        self.client.force_authenticate(self.officer)
        response = self.client.post(
            f"/api/v1/missions/{mission.pk}/acknowledge/", {}, format="json"
        )
        self.assertEqual(response.status_code, 403)
 
 
class DetailContractTests(MissionTestCase):
    """The drawer's response shape. If this changes, web breaks."""
 
    def test_detail_carries_the_timeline_and_photos(self):
        mission = self.make_mission(assigned_to=self.officer)
        services.acknowledge_mission(mission, officer=self.officer)
 
        client = APIClient()
        client.force_authenticate(self.dispatcher)
        body = client.get(f"/api/v1/missions/{mission.pk}/").json()
 
        for key in ["events", "photos", "created_by", "assigned_to", "cancellation_reason"]:
            self.assertIn(key, body)
        self.assertEqual([e["event_type"] for e in body["events"]], ["created", "assigned", "acknowledged"])
        self.assertEqual(set(body["assigned_to"]), {"id", "full_name", "badge_number"})
 
    def test_list_row_flags_overdue_missions(self):
        self.make_mission(
            assigned_to=self.officer, deadline=timezone.now() - timezone.timedelta(hours=1)
        )
        client = APIClient()
        client.force_authenticate(self.dispatcher)
        self.assertTrue(client.get("/api/v1/missions/").json()[0]["is_overdue"])
 