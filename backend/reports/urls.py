from django.urls import path

from .views import (
    DailyOfficerReportView,
    DailySummaryView,
    WeeklySummaryView,
    DailyOfficerReportCSVView,
    DailyOfficerReportPDFView,
    WeeklySummaryCSVView,
    WeeklySummaryPDFView,
)

urlpatterns = [
    path(
        "reports/daily/",
        DailyOfficerReportView.as_view(),
        name="daily-officer-report",
    ),
        path(
        "reports/daily/summary/",
        DailySummaryView.as_view(),
        name="daily-summary",
    ),
    path(
    "reports/weekly/",
    WeeklySummaryView.as_view(),
    name="weekly-summary",
    ),
    path(
    "reports/daily/export/csv/",
    DailyOfficerReportCSVView.as_view(),
    name="daily-officer-report-csv",
    ),
    path(
    "reports/daily/export/pdf/",
    DailyOfficerReportPDFView.as_view(),
    name="daily-officer-report-pdf",
    ),
    path(
        "reports/weekly/export/csv/",
        WeeklySummaryCSVView.as_view(),
        name="weekly-summary-csv",
    ),
    path(
        "reports/weekly/export/pdf/",
        WeeklySummaryPDFView.as_view(),
        name="weekly-summary-pdf",
    ),
]