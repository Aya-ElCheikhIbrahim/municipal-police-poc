from django.urls import path

from .views import (
    ActiveShiftsView,
    BulkLocationPingView,
    EndShiftView,
    OfficerTrailView,
    StartShiftView,
    TodayDutyView,
)

urlpatterns = [
    path("shifts/start/", StartShiftView.as_view(), name="shift-start"),
    path("shifts/end/", EndShiftView.as_view(), name="shift-end"),
    path("shifts/active/", ActiveShiftsView.as_view(), name="shift-active"),
    path("shifts/today/", TodayDutyView.as_view(), name="shift-today"),
    path("location-pings/bulk/", BulkLocationPingView.as_view(), name="ping-bulk"),
    path("officers/<int:officer_id>/trail/", OfficerTrailView.as_view(), name="officer-trail"),
]