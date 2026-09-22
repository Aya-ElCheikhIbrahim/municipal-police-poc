"""
The Area table, seeded with Tripoli's districts.

The centres are approximate: good enough to group missions into recognisable
parts of the city, and editable in the admin once real positions show where the
edges actually are.
"""

from django.db import migrations, models

# name, latitude, longitude, radius in metres
AREAS = [
    ("Abu Samra, Tripoli, Lebanon", 34.425800, 35.844700, 1000),
    ("Al Dam Wal Farez, Tripoli, Lebanon", 34.440200, 35.844300, 700),
    ("Al Maarad, Tripoli, Lebanon", 34.436600, 35.843300, 600),
    ("Al Nini, Tripoli, Lebanon", 34.433100, 35.838000, 700),
    ("Al Qobbe, Tripoli, Lebanon", 34.443300, 35.855600, 900),
    ("Al Tall, Tripoli, Lebanon", 34.435600, 35.842200, 700),
    ("Azmi Street, Tripoli, Lebanon", 34.438400, 35.839300, 500),
    ("Bahsas, Tripoli, Lebanon", 34.411500, 35.834700, 1200),
    ("Boulevard, Tripoli, Lebanon", 34.440200, 35.836500, 700),
    ("Central, Tripoli, Lebanon", 34.436700, 35.844000, 600),
    ("Corniche, Tripoli, Lebanon", 34.447500, 35.826500, 1200),
    ("Haddadine, Tripoli, Lebanon", 34.441900, 35.848700, 700),
    ("Jabal Mohsen, Tripoli, Lebanon", 34.448900, 35.853100, 900),
    ("Metran Street, Tripoli, Lebanon", 34.436300, 35.840900, 500),
    ("Mina, Tripoli, Lebanon", 34.450700, 35.820300, 1500),
    ("Mitein Street, Tripoli, Lebanon", 34.434000, 35.846100, 500),
    ("Old City, Tripoli, Lebanon", 34.437200, 35.848400, 800),
    ("Tabbaneh, Tripoli, Lebanon", 34.445800, 35.858600, 900),
    ("Zahrieh, Tripoli, Lebanon", 34.439400, 35.846400, 700),
]


def seed(apps, schema_editor):
    Area = apps.get_model("core", "Area")
    for name, latitude, longitude, radius_m in AREAS:
        Area.objects.get_or_create(
            name=name,
            defaults={
                "latitude": latitude,
                "longitude": longitude,
                "radius_m": radius_m,
            },
        )


def unseed(apps, schema_editor):
    Area = apps.get_model("core", "Area")
    Area.objects.filter(name__in=[name for name, *_ in AREAS]).delete()


class Migration(migrations.Migration):

    dependencies = [("core", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Area",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("latitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("longitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("radius_m", models.PositiveIntegerField(default=800, help_text="How far from the centre still counts as this area, in metres.")),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"db_table": "core_area", "ordering": ["name"]},
        ),
        migrations.RunPython(seed, unseed),
    ]
