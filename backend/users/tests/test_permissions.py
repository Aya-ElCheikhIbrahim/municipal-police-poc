from django.test import TestCase
from rest_framework.test import APIRequestFactory

from users.models import User
from core.permissions import (
    IsDispatcher,
    IsSupervisor,
    IsDispatcherOrSupervisor,
    IsSupervisorOrReadOnly,
    IsOfficer,
)


class PermissionTests(TestCase):

    def setUp(self):
        self.factory = APIRequestFactory()

        self.officer = User.objects.create_user(
            username="officer",
            password="TestPassword123!",
            full_name="Test Officer",
            badge_number="TP-0020",
            role="officer",
        )

        self.dispatcher = User.objects.create_user(
            username="dispatcher",
            password="TestPassword123!",
            full_name="Test Dispatcher",
            badge_number="TP-0021",
            role="dispatcher",
        )

        self.supervisor = User.objects.create_user(
            username="supervisor",
            password="TestPassword123!",
            full_name="Test Supervisor",
            badge_number="TP-0022",
            role="supervisor",
        )

    def test_is_dispatcher(self):
        request = self.factory.get("/")

        permission = IsDispatcher()

        request.user = self.dispatcher
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.officer
        self.assertFalse(permission.has_permission(request, None))

        request.user = self.supervisor
        self.assertFalse(permission.has_permission(request, None))

    def test_is_supervisor(self):
        request = self.factory.get("/")

        permission = IsSupervisor()

        request.user = self.supervisor
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.officer
        self.assertFalse(permission.has_permission(request, None))

        request.user = self.dispatcher
        self.assertFalse(permission.has_permission(request, None))

    def test_is_dispatcher_or_supervisor(self):
        request = self.factory.get("/")

        permission = IsDispatcherOrSupervisor()

        request.user = self.dispatcher
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.supervisor
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.officer
        self.assertFalse(permission.has_permission(request, None))

    def test_is_officer(self):
        request = self.factory.get("/")

        permission = IsOfficer()

        request.user = self.officer
        self.assertTrue(permission.has_permission(request, None))

        request.user = self.dispatcher
        self.assertFalse(permission.has_permission(request, None))

        request.user = self.supervisor
        self.assertFalse(permission.has_permission(request, None))