from django.urls import path

from .views import (
    ActiveShiftsView,
    BulkLocationPingView,
    EndShiftView,
    OfficerTrailView,
    StartShiftView,
)

urlpatterns = [
    path("shifts/start/", StartShiftView.as_view(), name="shift-start"),
    path("shifts/end/", EndShiftView.as_view(), name="shift-end"),
    path("shifts/active/", ActiveShiftsView.as_view(), name="shift-active"),
    path("location-pings/bulk/", BulkLocationPingView.as_view(), name="ping-bulk"),
    path("officers/<int:officer_id>/trail/", OfficerTrailView.as_view(), name="officer-trail"),
]