from rest_framework import serializers


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

class WeeklySummarySerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    missions_by_priority = serializers.DictField()
    missions_by_category = serializers.DictField()
    average_acknowledgement_seconds = serializers.FloatField()
    average_completion_seconds = serializers.FloatField()
    top_officers = TopOfficerSerializer(many=True)
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