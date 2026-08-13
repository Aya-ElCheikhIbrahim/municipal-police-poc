"""
users/urls.py

Routes for user managemnent. The router read UserViewwSet and generates a URL 
for eevry standard action plus every @action method


"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from users.views import UserViewSet, DeviceTokenViewSet

router = DefaultRouter()

router.register ("users", UserViewSet, basename="user")
router.register ("device_tokens", DeviceTokenViewSet, basename= "device_token")

app_name = "users"

urlpatterns = [
    path("", include(router.urls)),
]