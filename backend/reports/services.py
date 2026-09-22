from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from missions.models import Mission
from panic.models import PanicEvent
from shifts.models import Shift
from django.db.models import Avg, Count, Q
from shifts.services import trail_distance_m

User = get_user_model()


def generate_daily_officer_report(*,date,officer_id,status_filter=None,):
    officer = User.objects.filter(
        pk=officer_id,
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
    # Only the pings recorded on this day, so a shift that crosses midnight is
    # split between the two days. Shift.distance_m covers the whole shift and
    # would count it on both.
    distance_covered_m = sum(
        trail_distance_m(
            shift.pings.filter(
                recorded_at__gte=day_start,
                recorded_at__lt=day_end,
            ).order_by("recorded_at")
        )
        for shift in shifts
    )

    # ---------------------------------------------------------
    # MISSIONS
    # ---------------------------------------------------------
    missions = Mission.objects.filter(
        assigned_to=officer,
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
    missions_by_category = {
        category: missions.filter(category=category).count()
        for category, _ in Mission.Category.choices
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

    average_worked = missions.filter(
        status=Mission.Status.COMPLETED,
    ).aggregate(average=Avg("worked_seconds"))["average"]

    average_completion_seconds = (
        round(average_worked, 2) if average_worked is not None else 0
    )

    # Top-performing officers. A mission sent to several offciers counts for each of them, since they all worked on it

    completed = missions.filter(status=Mission.Status.COMPLETED)
    top = (
        User.objects.filter(
            missions_assigned__in=completed,
            role="officer",
        )
        .annotate(completed_missions=Count("missions_assigned", distinct=True))
        .order_by("-completed_missions", "full_name")[:5]
    )
    top_officers = [
        {
            "officer_id": officer.id,
            "officer_name": str(officer),
            "completed_missions": officer.completed_missions,
        }
        for officer in top
    ]

    return {
        "start_date": start_date,
        "end_date": end_date,
        "missions_by_priority": missions_by_priority,
        "average_acknowledgement_seconds": average_acknowledgement_seconds,
        "average_completion_seconds": average_completion_seconds,
        "top_officers": top_officers[:5],
        "missions_by_category": missions_by_category,
    }



def generate_daily_summary(*, date, status_filter=None):
    day_start = timezone.make_aware(datetime.combine(date, time.min))
    day_end = day_start + timedelta(days=1)

    shifts = (
        Shift.objects.filter(started_at__lt=day_end)
        .filter(Q(ended_at__isnull=True) | Q(ended_at__gt=day_start))
        .select_related("officer")
        .order_by("started_at")
    )

    rows = {}
    for shift in shifts:
        officer = shift.officer
        row = rows.setdefault(
            officer.id,
            {
                "officer_id": officer.id,
                "officer_name": str(officer),
                "badge_number": officer.badge_number,
                "shift_start": None,
                "shift_end": None,
                "still_on_duty": False,
                "hours_on_duty": 0.0,
                "distance_covered_m": 0,
                "missions_assigned": 0,
                "missions_completed": 0,
                "missions_cancelled": 0,
                "panic_events": 0,
            },
        )

        worked_from = max(shift.started_at, day_start)
        worked_to = min(shift.ended_at or timezone.now(), day_end)
        if worked_to > worked_from:
            row["hours_on_duty"] += (worked_to - worked_from).total_seconds() / 3600

        # The duty period the table shows: when they first came on and when
        # they last went off, within this day.
        if row["shift_start"] is None or worked_from < row["shift_start"]:
            row["shift_start"] = worked_from
        if shift.ended_at is None or shift.ended_at >= day_end:
            row["still_on_duty"] = True
        elif row["shift_end"] is None or shift.ended_at > row["shift_end"]:
            row["shift_end"] = shift.ended_at

        row["distance_covered_m"] += trail_distance_m(
            shift.pings.filter(
                recorded_at__gte=day_start,
                recorded_at__lt=day_end,
            ).order_by("recorded_at")
        )

    officer_ids = list(rows)

    missions = Mission.objects.filter(
        assigned_to__in=officer_ids,
        assigned_at__date=date,
    )
    if status_filter:
        missions = missions.filter(status=status_filter)

    # One grouped query instead of three per officer.
    for counts in missions.values("assigned_to").annotate(
        assigned=Count("id", distinct=True),
        completed=Count("id", filter=Q(status=Mission.Status.COMPLETED), distinct=True),
        cancelled=Count("id", filter=Q(status=Mission.Status.CANCELLED), distinct=True),
    ):
        row = rows.get(counts["assigned_to"])
        if row is None:
            continue
        row["missions_assigned"] = counts["assigned"]
        row["missions_completed"] = counts["completed"]
        row["missions_cancelled"] = counts["cancelled"]

    for counts in (
        PanicEvent.objects.filter(officer_id__in=officer_ids, triggered_at__date=date)
        .values("officer_id")
        .annotate(count=Count("id"))
    ):
        rows[counts["officer_id"]]["panic_events"] = counts["count"]

    officers = sorted(rows.values(), key=lambda row: row["officer_name"])
    for row in officers:
        row["hours_on_duty"] = round(row["hours_on_duty"], 2)

    totals = {
        "officers_on_duty": len(officers),
        "hours_on_duty": round(sum(row["hours_on_duty"] for row in officers), 2),
        "distance_covered_m": sum(row["distance_covered_m"] for row in officers),
        "missions_assigned": sum(row["missions_assigned"] for row in officers),
        "missions_completed": sum(row["missions_completed"] for row in officers),
        "missions_cancelled": sum(row["missions_cancelled"] for row in officers),
        "panic_events": sum(row["panic_events"] for row in officers),
    }

    return {"date": date, "totals": totals, "officers": officers}
