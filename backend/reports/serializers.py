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
    average_acknowledgement_seconds = serializers.FloatField()
    average_completion_seconds = serializers.FloatField()
    top_officers = TopOfficerSerializer(many=True)