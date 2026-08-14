"""
authentication/urls.py

Login, token refresh, and supervisor-issued password reset codes.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from authentication.views import (
    LoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
)

app_name = "authentication"

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]
