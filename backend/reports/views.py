import csv
from django.http import HttpResponse
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
)
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from core.permissions import IsDispatcherOrSupervisor
from . import services
from .serializers import (
    DailyOfficerReportSerializer,
    WeeklySummarySerializer,
)
from reportlab.pdfgen import canvas

from reports.services import (
    generate_daily_officer_report,
    generate_weekly_summary,
)
from .params import daily_params, weekly_params
    
class DailyOfficerReportView(APIView):
    """
    GET /api/v1/reports/daily/

    Generate a daily activity report for one officer.
    """

    permission_classes = [
        IsAuthenticated,
        IsDispatcherOrSupervisor,
    ]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                description="Report date, YYYY-MM-DD.",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="officer_id",
                description="Officer to generate the report for.",
                required=True,
                type=int,
            ),
            OpenApiParameter(
                name="status",
                description="Filter missions by status.",
                required=False,
                type=str,
            ),
        ],
        responses=DailyOfficerReportSerializer,
    )
    def get(self, request):
        date, officer_id, status_filter = daily_params(request)

        report = services.generate_daily_officer_report(
            date=date,
            officer_id=officer_id,
            status_filter=status_filter,
        )

        if report is None:
            return Response(
                {"detail": "Officer not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            DailyOfficerReportSerializer(report).data
        )


class WeeklySummaryView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDispatcherOrSupervisor,
    ]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="start_date",
                description="Start date, YYYY-MM-DD.",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="end_date",
                description="End date, YYYY-MM-DD.",
                required=True,
                type=str,
            ),
        ],
        responses=WeeklySummarySerializer,
    )
    def get(self, request):
        start_date, end_date = weekly_params(request)

        report = services.generate_weekly_summary(
            start_date=start_date,
            end_date=end_date,
        )

        return Response(
            WeeklySummarySerializer(report).data
        )

class DailyOfficerReportCSVView(APIView):
    """
    GET /api/v1/reports/daily/export/csv/

    Export a daily activity report as CSV.
    """

    permission_classes = [
        IsAuthenticated,
        IsDispatcherOrSupervisor,
    ]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                description="Report date, YYYY-MM-DD.",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="officer_id",
                description="Officer to generate the report for.",
                required=True,
                type=int,
            ),
            OpenApiParameter(
                name="status",
                description="Filter missions by status.",
                required=False,
                type=str,
            ),
        ],
        responses={
            200: OpenApiTypes.BINARY,
        },
    )
    def get(self, request):
        date, officer_id, status_filter = daily_params(request)

        report = services.generate_daily_officer_report(
            date=date,
            officer_id=officer_id,
            status_filter=status_filter,
        )

        if report is None:
            return Response(
                {"detail": "Officer not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = HttpResponse(
            content_type="text/csv"
        )

        response["Content-Disposition"] = (
            f'attachment; filename="daily_report_{date}_{officer_id}.csv"'
        )

        writer = csv.writer(response)

        writer.writerow([
            "Metric",
            "Value",
        ])

        writer.writerow([
            "Officer",
            report["officer_name"],
        ])

        writer.writerow([
            "Officer ID",
            report["officer_id"],
        ])

        writer.writerow([
            "Date",
            report["date"],
        ])

        writer.writerow([
            "Hours on duty",
            report["hours_on_duty"],
        ])

        writer.writerow([
            "Distance covered (m)",
            report["distance_covered_m"],
        ])

        writer.writerow([
            "Missions assigned",
            report["missions_assigned"],
        ])

        writer.writerow([
            "Missions completed",
            report["missions_completed"],
        ])

        writer.writerow([
            "Missions cancelled",
            report["missions_cancelled"],
        ])

        writer.writerow([
            "Panic events",
            report["panic_events"],
        ])

        return response


class DailyOfficerReportPDFView(APIView):
    """
    GET /api/v1/reports/daily/export/pdf/

    Export a daily activity report as PDF.
    """

    permission_classes = [
        IsAuthenticated,
        IsDispatcherOrSupervisor,
    ]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                description="Report date, YYYY-MM-DD.",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="officer_id",
                description="Officer to generate the report for.",
                required=True,
                type=int,
            ),
            OpenApiParameter(
                name="status",
                description="Filter missions by status.",
                required=False,
                type=str,
            ),
        ],
        responses={
            200: OpenApiTypes.BINARY,
        },
    )
    def get(self, request):
        date, officer_id, status_filter = daily_params(request)

        report = services.generate_daily_officer_report(
            date=date,
            officer_id=officer_id,
            status_filter=status_filter,
        )

        if report is None:
            return Response(
                {"detail": "Officer not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = HttpResponse(
            content_type="application/pdf"
        )

        response["Content-Disposition"] = (
            f'attachment; filename="daily_report_{date}_{officer_id}.pdf"'
        )

        pdf = canvas.Canvas(response)

        pdf.setTitle(
            "Daily Officer Activity Report"
        )

        y = 800

        pdf.setFont(
            "Helvetica-Bold",
            16,
        )

        pdf.drawString(
            50,
            y,
            "Daily Officer Activity Report",
        )

        y -= 40

        pdf.setFont(
            "Helvetica",
            11,
        )

        rows = [
            ("Officer", report["officer_name"]),
            ("Officer ID", report["officer_id"]),
            ("Date", str(report["date"])),
            ("Hours on duty", report["hours_on_duty"]),
            (
                "Distance covered (m)",
                report["distance_covered_m"],
            ),
            (
                "Missions assigned",
                report["missions_assigned"],
            ),
            (
                "Missions completed",
                report["missions_completed"],
            ),
            (
                "Missions cancelled",
                report["missions_cancelled"],
            ),
            (
                "Panic events",
                report["panic_events"],
            ),
        ]

        for label, value in rows:
            pdf.drawString(
                60,
                y,
                f"{label}: {value}",
            )

            y -= 25

        pdf.save()

        return response
class WeeklySummaryCSVView(APIView):
    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="start_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description="Start date, YYYY-MM-DD.",
            ),
            OpenApiParameter(
                name="end_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description="End date, YYYY-MM-DD.",
            ),
        ],
        responses={(200, "text/csv"): OpenApiTypes.BINARY},
    )
    def get(self, request):
        start_date, end_date = weekly_params(request)
        report = generate_weekly_summary(
            start_date=start_date,
            end_date=end_date,
        )

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="weekly_report_'
            f'{start_date}_{end_date}.csv"'
        )

        writer = csv.writer(response)

        writer.writerow(["Weekly Summary"])
        writer.writerow(["Start Date", report["start_date"]])
        writer.writerow(["End Date", report["end_date"]])
        writer.writerow([])

        writer.writerow(["Missions by Priority"])
        writer.writerow(["Priority", "Count"])

        for priority, count in report["missions_by_priority"].items():
            writer.writerow([priority, count])

        writer.writerow([])

        writer.writerow([
            "Average Acknowledgement Time (seconds)",
            report["average_acknowledgement_seconds"],
        ])

        writer.writerow([
            "Average Completion Time (seconds)",
            report["average_completion_seconds"],
        ])

        writer.writerow([])

        writer.writerow(["Top Officers"])
        writer.writerow([
            "Officer ID",
            "Officer Name",
            "Completed Missions",
        ])

        for officer in report["top_officers"]:
            writer.writerow([
                officer["officer_id"],
                officer["officer_name"],
                officer["completed_missions"],
            ])

        return response
    
class WeeklySummaryPDFView(APIView):
    permission_classes = [IsAuthenticated, IsDispatcherOrSupervisor]
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="start_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description="Start date, YYYY-MM-DD.",
            ),
            OpenApiParameter(
                name="end_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description="End date, YYYY-MM-DD.",
            ),
        ],
        responses={(200, "application/pdf"): OpenApiTypes.BINARY},
    )
    def get(self, request):
        start_date, end_date = weekly_params(request)
        report = generate_weekly_summary(
            start_date=start_date,
            end_date=end_date,
        )

        response = HttpResponse(content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="weekly_report_'
            f'{start_date}_{end_date}.pdf"'
        )

        pdf = canvas.Canvas(response)

        y = 800

        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(50, y, "Weekly Activity Report")

        y -= 30

        pdf.setFont("Helvetica", 11)
        pdf.drawString(
            50,
            y,
            f"Period: {start_date} to {end_date}",
        )

        y -= 40

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(50, y, "Missions by Priority")

        y -= 25

        pdf.setFont("Helvetica", 11)

        for priority, count in report["missions_by_priority"].items():
            pdf.drawString(
                70,
                y,
                f"{priority.title()}: {count}",
            )
            y -= 20

        y -= 15

        pdf.drawString(
            50,
            y,
            "Average Acknowledgement Time: "
            f"{report['average_acknowledgement_seconds']} seconds",
        )

        y -= 20

        pdf.drawString(
            50,
            y,
            "Average Completion Time: "
            f"{report['average_completion_seconds']} seconds",
        )

        y -= 40

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(50, y, "Top Officers")

        y -= 25

        pdf.setFont("Helvetica", 11)

        if report["top_officers"]:
            for officer in report["top_officers"]:
                pdf.drawString(
                    70,
                    y,
                    f"{officer['officer_name']} - "
                    f"{officer['completed_missions']} completed missions",
                )
                y -= 20
        else:
            pdf.drawString(70, y, "No completed missions.")

        pdf.save()

        return response