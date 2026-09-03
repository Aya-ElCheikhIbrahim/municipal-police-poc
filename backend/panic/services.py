"""
Business rules for the panic button (§4.7). Views stay thin; the rules that
Android and web both depend on live here.

Three transitions, and only three: trigger, cancel, resolve. `cancel` belongs
to the officer and closes inside a few seconds; `resolve` belongs to the
dispatcher and closes whenever the incident actually ends. They are not the
same thing and neither substitutes for the other.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from core.registry import get_setting
from shifts.models import Shift

from .models import PanicEvent


class PanicError(Exception):
    """A rule violation the API reports as 400."""


class PanicPermissionError(PanicError):
    """
    Wrong person for this action; the API reports 403.

    A subclass rather than a sibling so `except PanicError` anywhere else still
    catches it, and so the distinction missions/ already makes between "you may
    not" and "you may not yet" survives here too.
    """


def _as_decimal(value):
    return None if value is None else Decimal(str(value))


def trigger_panic(
    officer,
    latitude,
    longitude,
    accuracy_m=None,
    battery_level=None,
) -> tuple[PanicEvent, bool]:
    """
    §4.7 — raise the alarm. Returns (event, created).

    Requires an active shift for the same reason `ingest_pings` does: no shift
    means the officer is off duty and nothing about their location is tracked
    (§4.2, §5).

    Idempotent on purpose. Someone in trouble taps the button repeatedly and a
    phone on a bad connection retries the request; neither may produce a second
    alert, because two red markers for one person tells the dispatcher there
    are two emergencies.
    """
    shift = Shift.objects.filter(officer=officer, status=Shift.Status.ACTIVE).first()
    if shift is None:
        raise PanicError("No active shift. Start a shift before raising a panic alert.")

    existing = PanicEvent.objects.filter(
        officer=officer, status=PanicEvent.Status.ACTIVE
    ).first()
    if existing is not None:
        return existing, False

    try:
        # A savepoint, so losing the race below leaves the surrounding
        # transaction usable instead of poisoned — the caller may well be
        # inside an atomic block of its own.
        with transaction.atomic():
            event = PanicEvent.objects.create(
                officer=officer,
                shift=shift,
                latitude=_as_decimal(latitude),
                longitude=_as_decimal(longitude),
                accuracy_m=accuracy_m,
                battery_level=battery_level,
            )
        return event, True
    except IntegrityError:
        # Lost a race against unique_active_panic_per_officer; two taps
        # arrived at once and the other request won. Its event is the alert.
        existing = PanicEvent.objects.filter(
            officer=officer, status=PanicEvent.Status.ACTIVE
        ).first()
        if existing is None:
            raise
        return existing, False


@transaction.atomic
def cancel_panic(event: PanicEvent, officer) -> PanicEvent:
    """
    §4.7 — the officer withdraws their own alert.

    Only inside the grace window. Past it the dispatcher has already seen the
    alert on the map and may have sent someone, so the honest close is
    `resolve_panic` by whoever handled it, which leaves a record of that.
    """
    event = PanicEvent.objects.select_for_update().get(pk=event.pk)

    if event.officer_id != officer.id:
        raise PanicPermissionError("This panic alert is not yours to cancel.")

    _require_active(event, "cancel")

    grace = get_setting("panic_cancel_grace_seconds")
    if timezone.now() - event.triggered_at > timezone.timedelta(seconds=grace):
        raise PanicError(
            f"The {grace}-second cancellation window has passed. "
            "A dispatcher has to close this alert."
        )

    event.status = PanicEvent.Status.CANCELLED
    event.cancelled_at = timezone.now()
    event.save(update_fields=["status", "cancelled_at"])
    return event


@transaction.atomic
def resolve_panic(event: PanicEvent, actor, notes: str = "") -> PanicEvent:
    """
    §4.7 — a dispatcher or supervisor closes the alert.

    `select_for_update` because two dispatchers watching the same red marker
    will click at the same time; without the lock both would write, and the
    second would overwrite the first one's name and notes.
    """
    event = PanicEvent.objects.select_for_update().get(pk=event.pk)

    if not (getattr(actor, "is_dispatcher", False) or getattr(actor, "is_supervisor", False)):
        raise PanicPermissionError("Only a dispatcher or supervisor can resolve a panic alert.")

    _require_active(event, "resolve")

    event.status = PanicEvent.Status.RESOLVED
    event.resolved_at = timezone.now()
    event.resolved_by = actor
    event.notes = notes or ""
    event.save(update_fields=["status", "resolved_at", "resolved_by", "notes"])
    return event


def _require_active(event: PanicEvent, action: str) -> None:
    """
    A closed alert stays closed, whichever way it was closed.

    Cancelled and resolved are separate outcomes (SCHEMA.md), so neither may be
    turned into the other after the fact — that would rewrite what happened.
    """
    if event.status != PanicEvent.Status.ACTIVE:
        raise PanicError(
            f"Cannot {action} a panic alert that is already "
            f"{event.get_status_display().lower()}."
        )
