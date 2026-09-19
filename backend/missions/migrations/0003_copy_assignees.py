from django.db import migrations


def copy_assignees(apps, schema_editor):
    Mission = apps.get_model("missions", "Mission")
    for mission in Mission.objects.exclude(assigned_to=None):
        mission.assigned_officers.add(mission.assigned_to_id)


class Migration(migrations.Migration):
    dependencies = [("missions", "0002_add_assigned_officers")]
    operations = [migrations.RunPython(copy_assignees, migrations.RunPython.noop)]