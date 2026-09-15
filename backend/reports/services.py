from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from missions.models import Mission
from panic.models import PanicEvent
from shifts.models import Shift

User = get_user_model()


def generate_daily_officer_report(*,date,officer_id,status_filter=None,):
    officer = User.objects.filter(
        pk=officer_id,
        is_active=True,
        role="officer",
    ).first()

    if officer is None:
        return None

    # Start and end of the requested day
    day_start = timezone.make_aware(
        datetime.combine(date, time.min)
    )
    day_end = day_start + timedelta(days=1)

    # ---------------------------------------------------------
    # HOURS ON DUTY
    # ---------------------------------------------------------
    shifts = Shift.objects.filter(
        officer_id=officer_id,
        started_at__lt=day_end,
    ).filter(
        # Shift ended after the day started OR is still active
        ended_at__isnull=True
    ) | Shift.objects.filter(
        officer_id=officer_id,
        started_at__lt=day_end,
        ended_at__gt=day_start,
    )

    total_seconds = 0

    for shift in shifts:
        shift_start = max(shift.started_at, day_start)
        shift_end = min(
            shift.ended_at or timezone.now(),
            day_end,
        )

        if shift_end > shift_start:
            total_seconds += (shift_end - shift_start).total_seconds()

    hours_on_duty = round(total_seconds / 3600, 2)

    # ---------------------------------------------------------
    # DISTANCE COVERED
    # ---------------------------------------------------------
    # Shift.distance_m already contains the calculated distance
    # from the officer's location pings.
    distance_covered_m = sum(
        shift.distance_m
        for shift in shifts
        if shift.started_at < day_end
        and (shift.ended_at is None or shift.ended_at > day_start)
    )

    # ---------------------------------------------------------
    # MISSIONS
    # ---------------------------------------------------------
    missions = Mission.objects.filter(
        assigned_to_id=officer_id,
        assigned_at__date=date,
    )

    if status_filter:
        missions = missions.filter(status=status_filter)

    missions_assigned = missions.count()

    missions_completed = missions.filter(
        status=Mission.Status.COMPLETED
    ).count()

    missions_cancelled = missions.filter(
        status=Mission.Status.CANCELLED
    ).count()

    # ---------------------------------------------------------
    # PANIC EVENTS
    # ---------------------------------------------------------
    panic_events = PanicEvent.objects.filter(
        officer_id=officer_id,
        triggered_at__date=date,
    ).count()

    # ---------------------------------------------------------
    # FINAL REPORT
    # ---------------------------------------------------------
    return {
        "officer_id": officer.id,
        "officer_name": str(officer),
        "date": date,
        "hours_on_duty": hours_on_duty,
        "distance_covered_m": distance_covered_m,
        "missions_assigned": missions_assigned,
        "missions_completed": missions_completed,
        "missions_cancelled": missions_cancelled,
        "panic_events": panic_events,
    }
def generate_weekly_summary(*, start_date, end_date):
    missions = Mission.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )

    # Total missions by priority
    missions_by_priority = {
        priority: missions.filter(
            priority=priority
        ).count()
        for priority, _ in Mission.Priority.choices
    }

    # Average acknowledgement time
    acknowledged_missions = missions.filter(
        assigned_at__isnull=False,
        acknowledged_at__isnull=False,
    )

    acknowledgement_times = [
        (mission.acknowledged_at - mission.assigned_at).total_seconds()
        for mission in acknowledged_missions
    ]

    average_acknowledgement_seconds = (
        round(
            sum(acknowledgement_times) / len(acknowledgement_times),
            2,
        )
        if acknowledgement_times
        else 0
    )

    # Average completion time
    completed_missions = missions.filter(
        started_at__isnull=False,
        completed_at__isnull=False,
    )

    completion_times = [
        (mission.completed_at - mission.started_at).total_seconds()
        for mission in completed_missions
    ]

    average_completion_seconds = (
        round(
            sum(completion_times) / len(completion_times),
            2,
        )
        if completion_times
        else 0
    )

    # Top-performing officers
    officer_stats = {}

    for mission in missions.filter(
        assigned_to__isnull=False,
        status=Mission.Status.COMPLETED,
    ):
        officer_id = mission.assigned_to_id

        if officer_id not in officer_stats:
            officer_stats[officer_id] = {
                "completed_missions": 0,
            }

        officer_stats[officer_id]["completed_missions"] += 1

    top_officers = []

    for officer_id, stats in officer_stats.items():
        officer = User.objects.filter(
            pk=officer_id,
            is_active=True,
            role="officer",
        ).first()

        if officer:
            top_officers.append({
                "officer_id": officer.id,
                "officer_name": str(officer),
                "completed_missions": stats["completed_missions"],
            })

    top_officers.sort(
        key=lambda officer: officer["completed_missions"],
        reverse=True,
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "missions_by_priority": missions_by_priority,
        "average_acknowledgement_seconds": average_acknowledgement_seconds,
        "average_completion_seconds": average_completion_seconds,
        "top_officers": top_officers[:5],
    }