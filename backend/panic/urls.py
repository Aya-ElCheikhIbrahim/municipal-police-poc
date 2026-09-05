from django.urls import path
from .views import PanicAlertView

urlpatterns = [
    path('panic/', PanicAlertView.as_view(), name='panic-alert'),
]
