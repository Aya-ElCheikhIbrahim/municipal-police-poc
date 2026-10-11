from rest_framework import status
from rest_framework.test import APITestCase

from users.models import DeviceToken, User

URL = "/api/v1/device-tokens/"


class DeviceTokenRegistrationTests(APITestCase):
    """
    The Android app registers its FCM token on every launch, so registering
    a token that already exists must update it, not be rejected.
    """

    def setUp(self):
        self.officer = User.objects.create_user(
            username="officer",
            password="TestPassword123!",
            full_name="Test Officer",
            badge_number="TP-0030",
            role="officer",
        )
        self.other_officer = User.objects.create_user(
            username="other_officer",
            password="TestPassword123!",
            full_name="Other Officer",
            badge_number="TP-0031",
            role="officer",
        )
        self.client.force_authenticate(self.officer)

    def register(self, token="fcm-token", **extra):
        payload = {
            "token": token,
            "platform": "android",
            "device_model": "Google Pixel 8",
            "app_version": "0.1.0",
            **extra,
        }
        return self.client.post(URL, payload, format="json")

    def test_registering_the_same_token_twice_keeps_one_row(self):
        first = self.register()
        second = self.register()

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(status.is_success(second.status_code), second.data)
        self.assertEqual(DeviceToken.objects.filter(token="fcm-token").count(), 1)

    def test_re_registering_updates_device_details(self):
        self.register()
        self.register(device_model="Samsung Galaxy S24", app_version="0.2.0")

        token = DeviceToken.objects.get(token="fcm-token")
        self.assertEqual(token.device_model, "Samsung Galaxy S24")
        self.assertEqual(token.app_version, "0.2.0")

    def test_re_registering_reactivates_a_deactivated_token(self):
        # send_push deactivates tokens FCM reported as unregistered.
        DeviceToken.objects.create(
            user=self.officer,
            token="fcm-token",
            platform=DeviceToken.Platform.ANDROID,
            is_active=False,
        )

        response = self.register()

        self.assertTrue(status.is_success(response.status_code), response.data)
        self.assertTrue(DeviceToken.objects.get(token="fcm-token").is_active)

    def test_a_token_registered_by_another_user_moves_to_this_user(self):
        # Same phone, different officer logged in: pushes must follow the
        # officer now holding the phone.
        DeviceToken.objects.create(
            user=self.other_officer,
            token="fcm-token",
            platform=DeviceToken.Platform.ANDROID,
        )

        response = self.register()

        self.assertTrue(status.is_success(response.status_code), response.data)
        token = DeviceToken.objects.get(token="fcm-token")
        self.assertEqual(token.user, self.officer)
        self.assertEqual(DeviceToken.objects.filter(token="fcm-token").count(), 1)
