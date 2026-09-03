from django.urls import path

from .views import ActivePanicView, PanicCancelView, PanicResolveView, PanicTriggerView

urlpatterns = [
    path("panic/", PanicTriggerView.as_view(), name="panic-trigger"),
    path("panic/active/", ActivePanicView.as_view(), name="panic-active"),
    path("panic/<int:event_id>/cancel/", PanicCancelView.as_view(), name="panic-cancel"),
    path("panic/<int:event_id>/resolve/", PanicResolveView.as_view(), name="panic-resolve"),
]
