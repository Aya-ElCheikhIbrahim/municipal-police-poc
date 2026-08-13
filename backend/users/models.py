from django.db import models

# Create your models here.
"""
users/models.py

WHO the users are. `authentication/` handles how they prove it.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Role(models.TextChoices):
    OFFICER = "officer", "Officer"
    DISPATCHER = "dispatcher", "Dispatcher"
    SUPERVISOR = "supervisor", "Supervisor"


class Language(models.TextChoices):
    AR = "ar", "العربية"
    EN = "en", "English"


class UserManager(BaseUserManager):
    """
    Django's default UserManager assumes an `email` field exists. We removed it,
    so we need our own manager or `createsuperuser` crashes.
    """

    use_in_migrations = True

    def _create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError("Username is required")
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Role.SUPERVISOR)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self._create_user(username, password, **extra_fields)


class User(AbstractUser):
    """
    AbstractUser already gives us: username, password (hashed), is_active,
    is_staff, is_superuser, last_login, date_joined.

    We drop first_name / last_name / email — officers are identified by full
    Arabic name plus badge number, and there is no email in this system.
    """

    first_name = None
    last_name = None
    email = None

    full_name = models.CharField(max_length=150)
    badge_number = models.CharField(max_length=20, unique=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    preferred_language = models.CharField(
        max_length=2, choices=Language.choices, default=Language.AR
    )

    created_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    REQUIRED_FIELDS = ["full_name", "badge_number"]

    class Meta:
        db_table = "accounts_user"
        indexes = [models.Index(fields=["role", "is_active"])]
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.badge_number})"

    @property
    def is_officer(self):
        return self.role == Role.OFFICER

    @property
    def is_dispatcher(self):
        return self.role == Role.DISPATCHER

    @property
    def is_supervisor(self):
        return self.role == Role.SUPERVISOR


class DeviceToken(models.Model):
    class Platform(models.TextChoices):
        ANDROID = "android", "Android"
        WEB = "web", "Web"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="device_tokens"
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=10, choices=Platform.choices)
    device_model = models.CharField(max_length=100, blank=True)
    app_version = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_devicetoken"
        indexes = [models.Index(fields=["user", "is_active"])]

    def __str__(self):
        return f"{self.user.badge_number} — {self.platform}"


class PasswordResetCode(models.Model):
    """
    SMS is out of scope, so a Supervisor generates a code and reads it to the
    officer. Only the hash is stored.
    """


    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reset_codes"
    )
    code_hash = models.CharField(max_length=128)
    issued_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reset_codes_issued",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "accounts_passwordresetcode"
        indexes = [models.Index(fields=["user", "used_at"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"reset for {self.user.badge_number}"