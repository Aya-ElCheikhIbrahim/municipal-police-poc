from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from core.geo import haversine_m

from .activity import activity_feed
from core.models import Area
from missions.models import Mission, MissionWork
from panic.models import PanicEvent
from shifts.models import Shift
from django.db.models import Avg, Count, Q
from shifts.services import trail_distance_m

User = get_user_model()

# A mission an urgent call interrupted is still work in hand, so both screens
# and both filters treat paused as in progress. Only `missions_by_status` on
# the weekly report keeps them apart, because that breakdown is about the
# status machine rather than about what an officer is doing.
IN_PROGRESS_STATUSES = [Mission.Status.IN_PROGRESS, Mission.Status.PAUSED]


def filter_by_status(missions, status_filter):
    """Apply the screens' status filter, where "in progress" includes paused."""
    if not status_filter:
        return missions
    if status_filter == Mission.Status.IN_PROGRESS:
        return missions.filter(status__in=IN_PROGRESS_STATUSES)
    return missions.filter(status=status_filter)


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
    missions = filter_by_status(
        Mission.objects.filter(assigned_to=officer, assigned_at__date=date),
        status_filter,
    )

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
def generate_weekly_summary(*, start_date, end_date, officer_id=None, area_id=None):
    """
    Section 4.8 weekly summary, and the custom range report, which is the same
    figures over any span the supervisor picks.

    `officer_id` narrows everything to one officer. Mission breakdowns are
    keyed on when a mission was created; the per-officer rows are keyed on
    when it was assigned to them, the same as the daily report.
    """
    missions = Mission.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    if officer_id is not None:
        missions = missions.filter(assigned_to=officer_id)
    if area_id is not None:
        missions = missions.filter(area_id=area_id)

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

    missions_by_status = {
        value: missions.filter(status=value).count()
        for value, _ in Mission.Status.choices
    }

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

    officers = officer_rows_for_range(
        start_date=start_date,
        end_date=end_date,
        officer_id=officer_id,
        area_id=area_id,
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "missions_by_priority": missions_by_priority,
        "average_acknowledgement_seconds": average_acknowledgement_seconds,
        "average_completion_seconds": average_completion_seconds,
        "top_officers": top_officers[:5],
        "missions_by_category": missions_by_category,
        "missions_by_status": missions_by_status,
        "totals": {
            "officers": len(officers),
            "hours_on_duty": round(sum(row["hours_on_duty"] for row in officers), 2),
            "distance_covered_m": sum(row["distance_covered_m"] for row in officers),
            "missions_assigned": sum(row["missions_assigned"] for row in officers),
            "missions_completed": missions.filter(
                status=Mission.Status.COMPLETED
            ).count(),
            "missions_cancelled": sum(row["missions_cancelled"] for row in officers),
            "panic_events": sum(row["panic_events"] for row in officers),
        },
        "officers": officers,
    }



def generate_daily_summary(*, date, status_filter=None, area_id=None):
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
                "missions_in_progress": 0,
                "panic_events": 0,
                "areas": [],
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

    missions = filter_by_status(
        Mission.objects.filter(assigned_to__in=officer_ids, assigned_at__date=date),
        status_filter,
    )
    if area_id is not None:
        missions = missions.filter(area_id=area_id)

    # One grouped query instead of three per officer.
    for counts in missions.values("assigned_to").annotate(
        assigned=Count("id", distinct=True),
        completed=Count("id", filter=Q(status=Mission.Status.COMPLETED), distinct=True),
        cancelled=Count("id", filter=Q(status=Mission.Status.CANCELLED), distinct=True),
        in_progress=Count("id", filter=Q(status__in=IN_PROGRESS_STATUSES), distinct=True),
    ):
        row = rows.get(counts["assigned_to"])
        if row is None:
            continue
        row["missions_assigned"] = counts["assigned"]
        row["missions_completed"] = counts["completed"]
        row["missions_cancelled"] = counts["cancelled"]
        row["missions_in_progress"] = counts["in_progress"]

    # Where the officer worked. An officer can be in several districts in a
    # day, so this is a list with a count each and the busiest first; the
    # screen decides how to show that in one cell.
    for counts in (
        missions.values("assigned_to", "area_id", "area__name")
        .annotate(missions=Count("id", distinct=True))
        .order_by("assigned_to", "-missions")
    ):
        row = rows.get(counts["assigned_to"])
        if row is None:
            continue
        row["areas"].append({
            "area_id": counts["area_id"],
            "name": counts["area__name"],
            "missions": counts["missions"],
        })

    panics = PanicEvent.objects.filter(
        officer_id__in=officer_ids, triggered_at__date=date
    )
    for event in panics_in_area(panics, area_id):
        rows[event.officer_id]["panic_events"] += 1

    if area_id is not None:
        # An area filter asks "who worked in this district", so an officer who
        # was on duty elsewhere all day does not belong in the table.
        rows = {
            officer_id: row
            for officer_id, row in rows.items()
            if row["missions_assigned"] or row["panic_events"]
        }

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
        "missions_in_progress": sum(row["missions_in_progress"] for row in officers),
        "panic_events": sum(row["panic_events"] for row in officers),
    }

    return {"date": date, "totals": totals, "officers": officers}



def panics_in_area(panics, area_id):
    """
    The panic alerts that happened inside one area, or all of them when no
    area is asked for.

    Panic events store a position rather than an area: they are raised from a
    phone in the street, not created against a district the way a mission is.
    One area means one centre to measure against, so this stays a short loop.
    """
    if area_id is None:
        return list(panics)

    area = Area.objects.filter(pk=area_id).first()
    if area is None:
        return []

    centre = (float(area.latitude), float(area.longitude))
    return [
        event
        for event in panics
        if haversine_m(
            float(event.latitude), float(event.longitude), centre[0], centre[1]
        )
        <= area.radius_m
    ]


def officer_rows_for_range(*, start_date, end_date, officer_id=None, area_id=None):
    """
    One row per officer who was on duty or held a mission in the range: the
    officer activity table on the weekly and custom range screens.

    Hours and distance are clipped to the range, so a shift that starts the
    evening before only counts from midnight. Averages are that officer's own,
    not the period's.
    """
    range_start = timezone.make_aware(datetime.combine(start_date, time.min))
    range_end = timezone.make_aware(
        datetime.combine(end_date + timedelta(days=1), time.min)
    )

    shifts = (
        Shift.objects.filter(started_at__lt=range_end)
        .filter(Q(ended_at__isnull=True) | Q(ended_at__gt=range_start))
        .select_related("officer")
        .order_by("started_at")
    )
    if officer_id is not None:
        shifts = shifts.filter(officer_id=officer_id)

    def blank(officer):
        return {
            "officer_id": officer.id,
            "officer_name": str(officer),
            "badge_number": officer.badge_number,
            "hours_on_duty": 0.0,
            "distance_covered_m": 0,
            "missions_assigned": 0,
            "missions_completed": 0,
            "missions_cancelled": 0,
            "average_acknowledgement_seconds": 0,
            "average_completion_seconds": 0,
            "panic_events": 0,
        }

    rows = {}
    for shift in shifts:
        row = rows.setdefault(shift.officer_id, blank(shift.officer))

        worked_from = max(shift.started_at, range_start)
        worked_to = min(shift.ended_at or timezone.now(), range_end)
        if worked_to > worked_from:
            row["hours_on_duty"] += (worked_to - worked_from).total_seconds() / 3600

        row["distance_covered_m"] += trail_distance_m(
            shift.pings.filter(
                recorded_at__gte=range_start,
                recorded_at__lt=range_end,
            ).order_by("recorded_at")
        )

    # Missions the officer held in the range, even if they were never on duty
    # in it - a mission assigned on the last evening still belongs to them.
    missions = Mission.objects.filter(
        assigned_at__date__gte=start_date,
        assigned_at__date__lte=end_date,
    )
    if officer_id is not None:
        missions = missions.filter(assigned_to=officer_id)
    if area_id is not None:
        missions = missions.filter(area_id=area_id)

    for officer in User.objects.filter(missions_assigned__in=missions).distinct():
        rows.setdefault(officer.id, blank(officer))

    counts = missions.values("assigned_to").annotate(
        assigned=Count("id", distinct=True),
        completed=Count("id", filter=Q(status=Mission.Status.COMPLETED), distinct=True),
        cancelled=Count("id", filter=Q(status=Mission.Status.CANCELLED), distinct=True),
        average_completion=Avg(
            "worked_seconds", filter=Q(status=Mission.Status.COMPLETED)
        ),
    )
    for count in counts:
        row = rows.get(count["assigned_to"])
        if row is None:
            continue
        row["missions_assigned"] = count["assigned"]
        row["missions_completed"] = count["completed"]
        row["missions_cancelled"] = count["cancelled"]
        row["average_completion_seconds"] = (
            round(count["average_completion"], 2)
            if count["average_completion"] is not None
            else 0
        )

    # Acknowledgement time is a gap between two columns, so it is averaged in
    # Python rather than by the database.
    acknowledged = missions.filter(
        assigned_at__isnull=False, acknowledged_at__isnull=False
    ).prefetch_related("assigned_to")
    gaps = {}
    for mission in acknowledged:
        seconds = (mission.acknowledged_at - mission.assigned_at).total_seconds()
        for officer in mission.assigned_to.all():
            gaps.setdefault(officer.id, []).append(seconds)
    for officer_pk, values in gaps.items():
        row = rows.get(officer_pk)
        if row is not None:
            row["average_acknowledgement_seconds"] = round(sum(values) / len(values), 2)

    panics = PanicEvent.objects.filter(
        triggered_at__date__gte=start_date,
        triggered_at__date__lte=end_date,
    )
    if officer_id is not None:
        panics = panics.filter(officer_id=officer_id)
    for event in panics_in_area(panics, area_id):
        row = rows.get(event.officer_id)
        if row is not None:
            row["panic_events"] += 1

    if area_id is not None:
        rows = {
            officer_pk: row
            for officer_pk, row in rows.items()
            if row["missions_assigned"] or row["panic_events"]
        }

    officers = sorted(rows.values(), key=lambda row: row["officer_name"])
    for row in officers:
        row["hours_on_duty"] = round(row["hours_on_duty"], 2)
    return officers



def generate_officer_report(*, officer_id, start_date, end_date, status_filter=None):
    """
    One officer over a day, a week or any range: the page a supervisor lands on
    after clicking a name in the other reports. Returns None for an id that is
    not an officer's, so the view can answer 404.

    Nothing new is calculated here. The figures come from the same helper the
    weekly and custom range tables use, so a number can never disagree between
    two screens, and the timeline is the activity feed.

    The timeline is only filled for a single day, as the screen asks: a month
    of one officer's actions is a different question, and `/reports/activity/`
    answers it directly.
    """
    officer = User.objects.filter(pk=officer_id, role="officer").first()
    if officer is None:
        return None

    rows = officer_rows_for_range(
        start_date=start_date, end_date=end_date, officer_id=officer_id
    )
    row = rows[0] if rows else {
        "hours_on_duty": 0.0,
        "distance_covered_m": 0,
        "missions_assigned": 0,
        "missions_completed": 0,
        "missions_cancelled": 0,
        "average_acknowledgement_seconds": 0,
        "average_completion_seconds": 0,
        "panic_events": 0,
    }

    missions = (
        Mission.objects.filter(
            assigned_to=officer_id,
            assigned_at__date__gte=start_date,
            assigned_at__date__lte=end_date,
        )
        .select_related("area")
        .order_by("-assigned_at")
    )
    missions = filter_by_status(missions, status_filter)

    in_progress = missions.filter(status__in=IN_PROGRESS_STATUSES).count()

    history = [
        {
            "mission_id": mission.id,
            "title": mission.title,
            "status": mission.status,
            "priority": mission.priority,
            "category": mission.category,
            "area": mission.area.name if mission.area_id else None,
            "area_id": mission.area_id,
            "assigned_at": mission.assigned_at,
            "acknowledged_at": mission.acknowledged_at,
            "completed_at": mission.completed_at,
            "cancelled_at": mission.cancelled_at,
        }
        for mission in missions
    ]

    timeline = (
        activity_feed(date=start_date, officer_id=officer_id)
        if start_date == end_date
        else []
    )

    current_status, current_mission = officer_availability(officer)

    return {
        "officer": {
            "id": officer.id,
            "full_name": officer.full_name,
            "badge_number": officer.badge_number,
        },
        "start_date": start_date,
        "end_date": end_date,
        "current_status": current_status,
        "current_mission": current_mission,
        "summary": {
            "hours_on_duty": row["hours_on_duty"],
            "distance_covered_m": row["distance_covered_m"],
            "missions_assigned": row["missions_assigned"],
            "missions_completed": row["missions_completed"],
            "missions_cancelled": row["missions_cancelled"],
            "missions_in_progress": in_progress,
            "panic_events": row["panic_events"],
        },
        "performance": {
            "average_acknowledgement_seconds": row["average_acknowledgement_seconds"],
            "average_completion_seconds": row["average_completion_seconds"],
        },
        "timeline": timeline,
        "missions": history,
    }



def officer_availability(officer):
    """
    Where the officer stands right now: (status, current mission or None).

    Same order of precedence as the live map, so the officer page and the map
    can never label the same person differently: an open panic alert beats
    everything, then whether they are on duty at all, then whether they are on
    a mission.
    """
    if PanicEvent.objects.filter(
        officer=officer, status=PanicEvent.Status.ACTIVE
    ).exists():
        return "panic", None

    on_duty = Shift.objects.filter(
        officer=officer, status=Shift.Status.ACTIVE
    ).exists()
    if not on_duty:
        return "off_duty", None

    work = (
        MissionWork.objects.filter(officer=officer, ended_at__isnull=True)
        .select_related("mission")
        .first()
    )
    if work is None:
        return "available", None

    return "on_mission", {
        "mission_id": work.mission_id,
        "title": work.mission.title,
        "status": work.mission.status,
    }
