from django.urls import path

from .views import AreaListView, SystemSettingSchemaView, SystemSettingView

urlpatterns = [
    path("areas/", AreaListView.as_view(), name="area-list"),
    path("settings/", SystemSettingView.as_view(), name="system-settings"),
    path("settings/schema/", SystemSettingSchemaView.as_view(), name="system-settings-schema"),
]