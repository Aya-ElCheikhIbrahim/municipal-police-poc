from django.test import TestCase
from users.models import User

from rest_framework import status
from rest_framework.test import APITestCase

class PasswordHashingTests (TestCase):
    def test_password_is_hashed_with_argon2(self):
        user = User.objects.create_user(
            username=  "testOfficer1",
            password= "TestPassword123!",
            full_name= "Test Officer1",
            badge_number= "TP-0009",
            role=  "officer",
        )

        self.assertNotEqual(
            user.password,
            "TestPassword123!"
        )

        self.assertTrue(
            user.password.startswith("argon2$")
        )

        self.assertTrue(
            user.check_password("TestPassword123!")
        )


class InactiveUserAuthenticationTests(APITestCase):
    def test_inactive_user_cannot_login(self):
        User.objects.create_user(
            username="inactiveUser",
            password="TestPassword123!",
            full_name="Inactive User",
            badge_number="TP-0009",
            role="officer",
            is_active=False,
        )

        response = self.client.post(
        "/api/v1/login/",
        {
            "username": "inactiveUser",
            "password": "TestPassword123!",
        },
        format = "json",
        )
        self.assertNotEqual(response.status_code, status.HTTP_200_OK)