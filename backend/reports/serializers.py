from rest_framework import serializers

from core.serializers import OfficerBriefSerializer


class DailyOfficerReportSerializer(serializers.Serializer):
    officer_id = serializers.IntegerField()
    officer_name = serializers.CharField()
    date = serializers.DateField()

    hours_on_duty = serializers.FloatField()
    distance_covered_m = serializers.IntegerField()

    missions_assigned = serializers.IntegerField()
    missions_completed = serializers.IntegerField()
    missions_cancelled = serializers.IntegerField()
    panic_events = serializers.IntegerField()

class TopOfficerSerializer(serializers.Serializer):
    officer_id = serializers.IntegerField()
    officer_name = serializers.CharField()
    completed_missions = serializers.IntegerField()

class RangeTotalsSerializer(serializers.Serializer):
    """The cards above the weekly and custom range tables."""

    officers = serializers.IntegerField()
    hours_on_duty = serializers.FloatField()
    distance_covered_m = serializers.IntegerField()
    missions_assigned = serializers.IntegerField()
    missions_completed = serializers.IntegerField()
    missions_cancelled = serializers.IntegerField()
    panic_events = serializers.IntegerField()


class RangeOfficerSerializer(serializers.Serializer):
    """One row of the officer activity table."""

    officer_id = serializers.IntegerField()
    officer_name = serializers.CharField()
    badge_number = serializers.CharField()
    hours_on_duty = serializers.FloatField()
    distance_covered_m = serializers.IntegerField()
    missions_assigned = serializers.IntegerField()
    missions_completed = serializers.IntegerField()
    missions_cancelled = serializers.IntegerField()
    average_acknowledgement_seconds = serializers.FloatField()
    average_completion_seconds = serializers.FloatField()
    panic_events = serializers.IntegerField()


class WeeklySummarySerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    missions_by_priority = serializers.DictField()
    missions_by_category = serializers.DictField()
    missions_by_status = serializers.DictField()
    average_acknowledgement_seconds = serializers.FloatField()
    average_completion_seconds = serializers.FloatField()
    top_officers = TopOfficerSerializer(many=True)
    totals = RangeTotalsSerializer()
    officers = RangeOfficerSerializer(many=True)
class DailySummaryTotalsSerializer(serializers.Serializer):
    """The cards above the Daily Summary table."""

    officers_on_duty = serializers.IntegerField()
    hours_on_duty = serializers.FloatField()
    distance_covered_m = serializers.IntegerField()
    missions_assigned = serializers.IntegerField()
    missions_completed = serializers.IntegerField()
    missions_cancelled = serializers.IntegerField()
    panic_events = serializers.IntegerField()


class DailySummaryOfficerSerializer(serializers.Serializer):
    """One row of the Daily Summary table."""

    officer_id = serializers.IntegerField()
    officer_name = serializers.CharField()
    badge_number = serializers.CharField()

    # The duty period column. `shift_end` is null while the officer is still
    # on duty, which `still_on_duty` says explicitly so the client does not
    # have to guess why.
    shift_start = serializers.DateTimeField(allow_null=True)
    shift_end = serializers.DateTimeField(allow_null=True)
    still_on_duty = serializers.BooleanField()

    hours_on_duty = serializers.FloatField()
    distance_covered_m = serializers.IntegerField()
    missions_assigned = serializers.IntegerField()
    missions_completed = serializers.IntegerField()
    missions_cancelled = serializers.IntegerField()
    panic_events = serializers.IntegerField()


class DailySummarySerializer(serializers.Serializer):
    """GET /api/v1/reports/daily/summary/ - every officer on duty that day."""

    date = serializers.DateField()
    totals = DailySummaryTotalsSerializer()
    officers = DailySummaryOfficerSerializer(many=True)

class ActivityRowSerializer(serializers.Serializer):
    """
    One line of the activity feed: who did what, when and where.

    `officer` is who acted, and is null for the things the system did by
    itself, such as the unacknowledged-mission alert. `area` is null when the
    position falls outside every district.
    """

    at = serializers.DateTimeField()
    activity = serializers.CharField()
    activity_label = serializers.CharField()
    officer = OfficerBriefSerializer(allow_null=True)
    area = serializers.CharField(allow_null=True)
    area_id = serializers.IntegerField(allow_null=True)
    details = serializers.CharField(allow_blank=True)
    mission_id = serializers.IntegerField(allow_null=True)
    panic_id = serializers.IntegerField(allow_null=True)


class OfficerReportSummarySerializer(serializers.Serializer):
    """The cards at the top of the officer page."""

    hours_on_duty = serializers.FloatField()
    distance_covered_m = serializers.IntegerField()
    missions_assigned = serializers.IntegerField()
    missions_completed = serializers.IntegerField()
    missions_cancelled = serializers.IntegerField()
    missions_in_progress = serializers.IntegerField()
    panic_events = serializers.IntegerField()


class OfficerPerformanceSerializer(serializers.Serializer):
    """This officer's own averages, not the period's."""

    average_acknowledgement_seconds = serializers.FloatField()
    average_completion_seconds = serializers.FloatField()


class OfficerMissionSerializer(serializers.Serializer):
    """One line of the mission history, with the timestamps the screen shows."""

    mission_id = serializers.IntegerField()
    title = serializers.CharField()
    status = serializers.CharField()
    priority = serializers.CharField()
    category = serializers.CharField()
    area = serializers.CharField(allow_null=True)
    area_id = serializers.IntegerField(allow_null=True)
    assigned_at = serializers.DateTimeField(allow_null=True)
    acknowledged_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)
    cancelled_at = serializers.DateTimeField(allow_null=True)


class OfficerReportSerializer(serializers.Serializer):
    """
    GET /api/v1/reports/officer/ - one officer over a day or a range.

    `timeline` is only filled for a single day; over a longer range it is empty
    and the client asks /reports/activity/ for whatever slice it needs.
    """

    officer = OfficerBriefSerializer()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    summary = OfficerReportSummarySerializer()
    performance = OfficerPerformanceSerializer()
    timeline = ActivityRowSerializer(many=True)
    missions = OfficerMissionSerializer(many=True)
