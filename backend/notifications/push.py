"""
notifications/push.py

Delivers push notifications to phones through Firebase Cloud Messaging (FCM).

The Notification row in the database is the record; a push is best effort on
top of it. So nothing here ever raises into the caller: a Firebase outage or a
stale phone token must not fail assigning or cancelling a mission.

Push is off while FCM_CREDENTIALS_FILE is empty, which keeps tests and
teammates without a Firebase key working unchanged.
"""

import logging
from pathlib import Path

from django.conf import settings

from users.models import DeviceToken

logger = logging.getLogger(__name__)

APP_NAME = "municipal-police-push"

# The Android app must create a notification channel with this same id.
ANDROID_CHANNEL_ID = "missions"

# FCM's limit for one multicast request.
MAX_TOKENS_PER_REQUEST = 500

_app = None


def is_enabled() -> bool:
    return bool(settings.FCM_CREDENTIALS_FILE)


def _credentials_path() -> Path:
    """A relative path in .env is read from the backend folder, not the shell's."""
    path = Path(settings.FCM_CREDENTIALS_FILE)
    return path if path.is_absolute() else settings.BASE_DIR / path


def _get_app():
    """Initialise Firebase once per process, on first use."""
    global _app
    if _app is None:
        import firebase_admin
        from firebase_admin import credentials

        try:
            _app = firebase_admin.get_app(APP_NAME)
        except ValueError:
            _app = firebase_admin.initialize_app(
                credentials.Certificate(str(_credentials_path())), name=APP_NAME
            )
    return _app


def send_push(user, title: str, body: str, data: dict | None = None) -> int:
    """
    Push to every active device registered by `user`.

    Returns how many devices accepted the message. Tokens FCM reports as no
    longer valid (app uninstalled, token rotated) are deactivated so they are
    not tried again.
    """
    if not is_enabled():
        return 0

    tokens = list(
        DeviceToken.objects.filter(user=user, is_active=True).values_list("token", flat=True)
    )
    if not tokens:
        return 0

    try:
        from firebase_admin import messaging

        app = _get_app()
        # FCM data payloads only accept string values.
        payload = {key: str(value) for key, value in (data or {}).items()}

        delivered = 0
        dead_tokens = []
        for start in range(0, len(tokens), MAX_TOKENS_PER_REQUEST):
            batch = tokens[start:start + MAX_TOKENS_PER_REQUEST]
            message = messaging.MulticastMessage(
                tokens=batch,
                notification=messaging.Notification(title=title, body=body),
                data=payload,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(channel_id=ANDROID_CHANNEL_ID),
                ),
            )
            response = messaging.send_each_for_multicast(message, app=app)
            delivered += response.success_count

            for token, result in zip(batch, response.responses):
                if result.success:
                    continue
                if isinstance(
                    result.exception,
                    (messaging.UnregisteredError, messaging.SenderIdMismatchError),
                ):
                    dead_tokens.append(token)
                else:
                    logger.warning("Push to user %s failed: %s", user.pk, result.exception)

        if dead_tokens:
            DeviceToken.objects.filter(token__in=dead_tokens).update(is_active=False)
        return delivered

    except Exception:
        logger.exception("Push notification failed for user %s", user.pk)
        return 0