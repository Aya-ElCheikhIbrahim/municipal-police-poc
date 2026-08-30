from django.urls import path
 
from .views import (
    MissionAcknowledgeView,
    MissionAssignView,
    MissionCancelView,
    MissionCompleteView,
    MissionDetailView,
    MissionListCreateView,
    MissionNoteView,
    MissionPhotoView,
    MissionStartView,
    UnacknowledgedSweepView,
)
 
urlpatterns = [
    path("missions/", MissionListCreateView.as_view(), name="mission-list"),
    path(
        "missions/sweep-unacknowledged/",
        UnacknowledgedSweepView.as_view(),
        name="mission-sweep",
    ),
    path("missions/<int:mission_id>/", MissionDetailView.as_view(), name="mission-detail"),
    path("missions/<int:mission_id>/assign/", MissionAssignView.as_view(), name="mission-assign"),
    path(
        "missions/<int:mission_id>/acknowledge/",
        MissionAcknowledgeView.as_view(),
        name="mission-acknowledge",
    ),
    path("missions/<int:mission_id>/start/", MissionStartView.as_view(), name="mission-start"),
    path(
        "missions/<int:mission_id>/complete/",
        MissionCompleteView.as_view(),
        name="mission-complete",
    ),
    path("missions/<int:mission_id>/cancel/", MissionCancelView.as_view(), name="mission-cancel"),
    path("missions/<int:mission_id>/notes/", MissionNoteView.as_view(), name="mission-note"),
    path("missions/<int:mission_id>/photos/", MissionPhotoView.as_view(), name="mission-photo"),
]
 