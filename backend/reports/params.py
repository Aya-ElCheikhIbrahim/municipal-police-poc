"""
Query-parameter parsing for the report endpoints.

All six report views take the same parameters, so they are checked here once.
A bad value raises ParseError, which DRF turns into a 400 with
{"detail": "..."}, the same shape the rest of the API uses.
"""

from datetime import datetime

from rest_framework.exceptions import ParseError

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
    """(date, status_filter) for the all-officers daily summary."""
    return _parse_date(request, "date"), _parse_status(request)
def weekly_params(request):
    """(start_date, end_date) for the weekly summary and its exports."""
    start_date = _parse_date(request, "start_date")
    end_date = _parse_date(request, "end_date")
    if start_date > end_date:
        raise ParseError("start_date cannot be after end_date.")
    return start_date, end_date