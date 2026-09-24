"""
Link each mission to the district it happened in, and fill in the ones that
already exist.
"""

import math

import django.db.models.deletion
from django.db import migrations, models

EARTH_RADIUS_M = 6_371_000


def _distance_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def backfill(apps, schema_editor):
    Area = apps.get_model("core", "Area")
    Mission = apps.get_model("missions", "Mission")

    areas = list(Area.objects.filter(is_active=True))
    if not areas:
        return

    for mission in Mission.objects.filter(area__isnull=True):
        best, best_distance = None, None
        for area in areas:
            distance = _distance_m(
                float(mission.latitude), float(mission.longitude),
                float(area.latitude), float(area.longitude),
            )
            if distance <= area.radius_m and (best_distance is None or distance < best_distance):
                best, best_distance = area, distance
        if best is not None:
            mission.area = best
            mission.save(update_fields=["area"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_area"),
        ("missions", "0010_backfill_working_time"),
    ]

    operations = [
        migrations.AddField(
            model_name="mission",
            name="area",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="missions",
                to="core.area",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
