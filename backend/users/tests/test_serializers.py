from django.test import TestCase

from users.models import User
from users.serializers import MeUpdateSerializer

class MeUpdateSerializerTests (TestCase):
    def setUp(self):
        self.user= User.objects.create_user(
            username= "testofficer",
            password= "TestPassword123!",
            full_name= "Test Officer",
            badge_number="TP-0009",
            role="officer",
            phone="70123456",
            preferred_language= "ar"
        )

    def test_acceepts_phone_and_language(self):
        serializer = MeUpdateSerializer(
            instance=self.user,
            data={
                "phone": "71123456",
                "preferred_language": "en",
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid())
        serializer.save()
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "71123456")
        self.assertEqual(self.user.preferred_language, "en")

    def test_cannot_change_role(self):
        original_role= self.user.role

        serializer = MeUpdateSerializer(
            instance = self.user,
            data = {
                "role":"supervisor",
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid())
        serializer.save()

        self.user.refresh_from_db()
        self.assertEqual(self.user.role, original_role)