"""
authentication/services.py

Password reset business logic. SMS is out of scope for this POC: a
supervisor generates a code here and reads it aloud to the officer, so the
plain code is only ever visible at the moment it's issued.
"""

import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from users.models import PasswordResetCode

RESET_CODE_TTL = timedelta(minutes=15)


def issue_reset_code(user, issued_by) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    PasswordResetCode.objects.create(
        user=user,
        code_hash=make_password(code),
        issued_by=issued_by,
        expires_at=timezone.now() + RESET_CODE_TTL,
    )
    return code


def confirm_reset(user, code, new_password) -> None:
    reset_code = (
        PasswordResetCode.objects.filter(user=user, used_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if reset_code is None:
        raise ValueError("No pending reset code for this user.")
    if reset_code.expires_at < timezone.now():
        raise ValueError("This reset code has expired.")
    if not check_password(code, reset_code.code_hash):
        raise ValueError("Incorrect reset code.")

    user.set_password(new_password)
    user.save(update_fields=["password"])

    reset_code.used_at = timezone.now()
    reset_code.save(update_fields=["used_at"])
