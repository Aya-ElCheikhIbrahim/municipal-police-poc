from django.contrib import admin

from .models import Area


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    """
    Editable on purpose: the seeded centres are approximate, and a supervisor
    who knows the city can move one without a migration.
    """

    list_display = ("name", "latitude", "longitude", "radius_m", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
