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
from .arabic import (
    LABELS,
    PRIORITIES,
    RIGHT,
    daily_rows,
    digits,
    draw_line,
    pdf_value,
    written_date,
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

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="daily_report_{date}_{officer_id}.csv"'
        )
        # Byte-order mark first, or Excel opens the file with the wrong
        # encoding and the Arabic comes out as garbage.
        response.write("\ufeff")

        writer = csv.writer(response)
        writer.writerow([LABELS["metric"], LABELS["value"]])
        for label, value in daily_rows(report):
            writer.writerow([label, value])

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

        response = HttpResponse(content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="daily_report_{date}_{officer_id}.pdf"'
        )

        pdf = canvas.Canvas(response)
        pdf.setTitle(LABELS["daily_title"])

        y = 800
        draw_line(pdf, y, LABELS["daily_title"], size=16, bold=True)
        y -= 40

        for label, value in daily_rows(report):
            draw_line(pdf, y, f"{label}: {pdf_value(value)}")
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

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="weekly_report_'
            f'{start_date}_{end_date}.csv"'
        )
        # Byte-order mark first, or Excel opens the file with the wrong
        # encoding and the Arabic comes out as garbage.
        response.write("\ufeff")

        writer = csv.writer(response)

        writer.writerow([LABELS["weekly_title"]])
        writer.writerow([LABELS["start_date"], report["start_date"]])
        writer.writerow([LABELS["end_date"], report["end_date"]])
        writer.writerow([])

        writer.writerow([LABELS["missions_by_priority"]])
        writer.writerow([LABELS["priority"], LABELS["count"]])
        for priority, count in report["missions_by_priority"].items():
            writer.writerow([PRIORITIES[priority], count])
        writer.writerow([])

        writer.writerow([
            f'{LABELS["avg_ack"]} ({LABELS["seconds"]})',
            report["average_acknowledgement_seconds"],
        ])
        writer.writerow([
            f'{LABELS["avg_completion"]} ({LABELS["seconds"]})',
            report["average_completion_seconds"],
        ])
        writer.writerow([])

        writer.writerow([LABELS["top_officers"]])
        writer.writerow([
            LABELS["officer_id"],
            LABELS["officer"],
            LABELS["completed_missions"],
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
        pdf.setTitle(LABELS["weekly_title"])

        y = 800
        draw_line(pdf, y, LABELS["weekly_title"], size=16, bold=True)
        y -= 30

        draw_line(
            pdf,
            y,
            f'{LABELS["period"]}: {LABELS["from"]} {written_date(start_date)} '
            f'{LABELS["to"]} {written_date(end_date)}',
        )
        y -= 40

        draw_line(pdf, y, LABELS["missions_by_priority"], size=12, bold=True)
        y -= 25
        for priority, count in report["missions_by_priority"].items():
            draw_line(pdf, y, f"{PRIORITIES[priority]}: {digits(count)}", right=RIGHT - 20)
            y -= 20
        y -= 15

        draw_line(
            pdf,
            y,
            f'{LABELS["avg_ack"]}: '
            f'{digits(report["average_acknowledgement_seconds"])} {LABELS["seconds"]}',
        )
        y -= 20
        draw_line(
            pdf,
            y,
            f'{LABELS["avg_completion"]}: '
            f'{digits(report["average_completion_seconds"])} {LABELS["seconds"]}',
        )
        y -= 40

        draw_line(pdf, y, LABELS["top_officers"], size=12, bold=True)
        y -= 25
        if report["top_officers"]:
            for officer in report["top_officers"]:
                draw_line(
                    pdf,
                    y,
                    f'{officer["officer_name"]} — '
                    f'{digits(officer["completed_missions"])} {LABELS["completed_count"]}',
                    right=RIGHT - 20,
                )
                y -= 20
        else:
            draw_line(pdf, y, LABELS["no_completed_missions"], right=RIGHT - 20)

        pdf.save()

        return response