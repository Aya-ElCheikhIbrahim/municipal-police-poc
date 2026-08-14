"""
config/urls.py - root URL router.

Delegates whole prefix to each app. Never  define indivisual endpoints here.

"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


api_v1 = [
    path("", include ("users.urls")),
]


urlpatterns = [
    path ("admin/", admin.site.urls),
    path ("api/v1/", include ((api_v1, "v1"))),

    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]


if settings.DEBUG:

    urlpatterns += static (settings.MEDIA_URL, document_root = settings.MEDIA_ROOT)
