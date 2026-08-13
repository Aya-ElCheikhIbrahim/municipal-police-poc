"""
config/urls.py - root URL router.

Delegates whole prefix to each app. Never  define indivisual endpoints here.

"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path ("admin/", admin.site.urls),
]