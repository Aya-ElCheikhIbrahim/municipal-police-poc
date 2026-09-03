"""
notifications/urls.py

Mounted at /api/v1/notifications/ from config/urls.py.
"""

from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path(
        "",
        views.NotificationListView.as_view(),
        name="list",
    ),
    path(
        "unread-count/",
        views.NotificationUnreadCountView.as_view(),
        name="unread-count",
    ),
    path(
        "mark-all-read/",
        views.NotificationMarkAllReadView.as_view(),
        name="mark-all-read",
    ),
    path(
        "<int:pk>/read/",
        views.NotificationMarkReadView.as_view(),
        name="mark-read",
    ),
]