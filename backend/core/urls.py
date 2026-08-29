from django.urls import path

from .views import SystemSettingSchemaView, SystemSettingView

urlpatterns = [
    path("settings/", SystemSettingView.as_view(), name="system-settings"),
    path("settings/schema/", SystemSettingSchemaView.as_view(), name="system-settings-schema"),
]