from django.db import migrations


def backfill(apps, schema_editor):
    Mission = apps.get_model("missions", "Mission")
    MissionWork = apps.get_model("missions", "MissionWork")

    # Finished missions: all their time was worked (no pauses existed before).
    for mission in Mission.objects.filter(
        started_at__isnull=False, status__in=["completed", "cancelled"]
    ):
        end = mission.completed_at or mission.cancelled_at
        if end:
            mission.worked_seconds = max(0, int((end - mission.started_at).total_seconds()))
            mission.save(update_fields=["worked_seconds"])

    # Missions in progress: the running period started when the mission did,
    # and every assigned officer is working it. An officer holding two
    # (possible before this rule) keeps only the most recently started one.
    busy = set()
    for mission in Mission.objects.filter(status="in_progress").order_by("-started_at"):
        mission.resumed_at = mission.started_at
        mission.save(update_fields=["resumed_at"])
        for officer_id in mission.assigned_to.values_list("id", flat=True):
            if officer_id in busy:
                continue
            MissionWork.objects.create(
                mission=mission, officer_id=officer_id, started_at=mission.started_at
            )
            busy.add(officer_id)


class Migration(migrations.Migration):
    dependencies = [("missions", "0009_mission_paused_and_working_time")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]