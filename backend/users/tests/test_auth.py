from django.test import TestCase
from users.models import User

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

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


class LogoutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="logoutOfficer",
            password="TestPassword123!",
            full_name="Logout Officer",
            badge_number="TP-0010",
            role="officer",
        )

    def test_valid_refresh_token_is_blacklisted(self):
        refresh = RefreshToken.for_user(self.user)

        response = self.client.post(
            "/api/v1/logout/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        refresh_response = self.client.post(
            "/api/v1/token/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_garbage_refresh_token_returns_400(self):
        response = self.client.post(
            "/api/v1/logout/",
            {"refresh": "not-a-real-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_succeeds_without_authorization_header(self):
        refresh = RefreshToken.for_user(self.user)

        self.client.credentials()
        response = self.client.post(
            "/api/v1/logout/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)