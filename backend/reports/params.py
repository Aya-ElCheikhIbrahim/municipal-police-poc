"""
Query-parameter parsing for the report endpoints.

All six report views take the same parameters, so they are checked here once.
A bad value raises ParseError, which DRF turns into a 400 with
{"detail": "..."}, the same shape the rest of the API uses.
"""

from datetime import datetime, time

from rest_framework.exceptions import ParseError

from core.models import Area
from missions.models import Mission


def _parse_date(request, name):
    raw = request.query_params.get(name)
    if not raw:
        raise ParseError(f"{name} is required. Use {name}=YYYY-MM-DD.")
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        raise ParseError(f"Use {name}=YYYY-MM-DD.")


def _parse_status(request):
    status_filter = request.query_params.get("status") or None
    if status_filter is not None and status_filter not in Mission.Status.values:
        raise ParseError(
            f"status must be one of: {', '.join(Mission.Status.values)}."
        )
    return status_filter


def _parse_area(request):
    """
    The area filter, checked against the table so a stale id from an old
    dropdown reads as a mistake rather than silently emptying the report.
    """
    raw_area_id = request.query_params.get("area_id")
    if not raw_area_id:
        return None
    if not raw_area_id.isdigit():
        raise ParseError("area_id must be a number.")
    if not Area.objects.filter(pk=raw_area_id).exists():
        raise ParseError("Unknown area_id.")
    return int(raw_area_id)


def daily_params(request):
    """(date, officer_id, status_filter) for the daily report and its exports."""
    date = _parse_date(request, "date")

    raw_officer_id = request.query_params.get("officer_id")
    if not raw_officer_id:
        raise ParseError("officer_id is required.")
    if not raw_officer_id.isdigit():
        raise ParseError("officer_id must be a number.")

    return date, int(raw_officer_id), _parse_status(request)


def daily_summary_params(request):
    """(date, status_filter, area_id) for the all-officers daily summary."""
    return _parse_date(request, "date"), _parse_status(request), _parse_area(request)
def weekly_params(request):
    """
    (start_date, end_date, officer_id, area_id) for the weekly summary, the
    custom range report and their exports. Both filters are optional: without
    them the report covers everyone, everywhere.
    """
    start_date = _parse_date(request, "start_date")
    end_date = _parse_date(request, "end_date")
    if start_date > end_date:
        raise ParseError("start_date cannot be after end_date.")

    raw_officer_id = request.query_params.get("officer_id")
    if raw_officer_id and not raw_officer_id.isdigit():
        raise ParseError("officer_id must be a number.")

    return (
        start_date,
        end_date,
        int(raw_officer_id) if raw_officer_id else None,
        _parse_area(request),
    )

def _parse_time(request, name):
    """HH:MM, or None when the caller wants the whole day."""
    raw = request.query_params.get(name)
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%H:%M").time()
    except ValueError:
        raise ParseError(f"Use {name}=HH:MM.")


def activity_params(request):
    """(date, from_time, to_time, officer_id, area_id) for the activity feed."""
    date = _parse_date(request, "date")
    from_time = _parse_time(request, "from_time")
    to_time = _parse_time(request, "to_time")
    if from_time and to_time and from_time > to_time:
        raise ParseError("from_time cannot be after to_time.")

    raw_officer_id = request.query_params.get("officer_id")
    if raw_officer_id and not raw_officer_id.isdigit():
        raise ParseError("officer_id must be a number.")

    return (
        date,
        from_time,
        to_time,
        int(raw_officer_id) if raw_officer_id else None,
        _parse_area(request),
    )
