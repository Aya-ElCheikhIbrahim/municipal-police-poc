from django.test import TestCase

from users.models import User


class UserCreationTests(TestCase):

    def test_user_creation_hashes_password(self):
        user = User.objects.create_user(
            username="newuser",
            password="TestPassword123!",
            full_name="New User",
            badge_number="TP-0011",
            role="officer",
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


class UserUpdateTests(TestCase):

    def test_user_update_does_not_change_password(self):
        original_password = "TestPassword123!"

        user = User.objects.create_user(
            username="updateuser",
            password=original_password,
            full_name="Original Name",
            badge_number="TP-0012",
            role="officer",
        )

        original_hash = user.password

        user.full_name = "Updated Name"
        user.phone = "71123456"
        user.save()

        user.refresh_from_db()

        self.assertEqual(user.password, original_hash)

        self.assertTrue(
            user.check_password(original_password)
        )