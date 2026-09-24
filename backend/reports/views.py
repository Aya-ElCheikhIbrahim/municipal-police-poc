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
from core.permissions import IsSupervisor
from . import services
from .serializers import (
    ActivityRowSerializer,
    DailyOfficerReportSerializer,
    OfficerReportSerializer,
    WeeklySummarySerializer,
    DailySummarySerializer,
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
    CATEGORIES,
    daily_rows,
    digits,
    draw_line,
    pdf_value,
    written_date,
)
from . import activity
from .params import (
    activity_params,
    daily_params,
    daily_summary_params,
    officer_report_params,
    weekly_params,
)
class DailyOfficerReportView(APIView):
    """
    GET /api/v1/reports/daily/

    Generate a daily activity report for one officer.
    """

    permission_classes = [
        IsAuthenticated,
        IsSupervisor,
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
        IsSupervisor,
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
            OpenApiParameter(
                name="officer_id",
                description="Narrow the whole report to one officer.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="area_id",
                description="Narrow the whole report to one area.",
                required=False,
                type=int,
            ),
        ],
        responses=WeeklySummarySerializer,
    )
    def get(self, request):
        start_date, end_date, officer_id, area_id = weekly_params(request)

        report = services.generate_weekly_summary(
            start_date=start_date,
            end_date=end_date,
            officer_id=officer_id,
            area_id=area_id,
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
        IsSupervisor,
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
        IsSupervisor,
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
    permission_classes = [IsAuthenticated, IsSupervisor]

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
        start_date, end_date, officer_id, area_id = weekly_params(request)
        report = generate_weekly_summary(
            start_date=start_date,
            end_date=end_date,
            officer_id=officer_id,
            area_id=area_id,
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
        writer.writerow([LABELS["missions_by_category"]])
        writer.writerow([LABELS["category"], LABELS["count"]])
        for category, count in report["missions_by_category"].items():
            writer.writerow([CATEGORIES[category], count])
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
    permission_classes = [IsAuthenticated, IsSupervisor]
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
        start_date, end_date, officer_id, area_id = weekly_params(request)
        report = generate_weekly_summary(
            start_date=start_date,
            end_date=end_date,
            officer_id=officer_id,
            area_id=area_id,
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
        draw_line(pdf, y, LABELS["missions_by_category"], size=12, bold=True)
        y -= 25
        for category, count in report["missions_by_category"].items():
            draw_line(pdf, y, f"{CATEGORIES[category]}: {digits(count)}", right=RIGHT - 20)
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




class DailySummaryView(APIView):
    """
    GET /api/v1/reports/daily/summary/ - section 4.8, the whole shift for one day.

    The per-officer report answers for one person and backs the exports; this
    one backs the dashboard table listing everyone who was on duty.
    """

    permission_classes = [
        IsAuthenticated,
        IsSupervisor,
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
                name="status",
                description="Filter missions by status.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="area_id",
                description="Only officers who worked in this area.",
                required=False,
                type=int,
            ),
        ],
        responses=DailySummarySerializer,
    )
    def get(self, request):
        date, status_filter, area_id = daily_summary_params(request)

        report = services.generate_daily_summary(
            date=date,
            status_filter=status_filter,
            area_id=area_id,
        )

        return Response(DailySummarySerializer(report).data)

class ActivityFeedView(APIView):
    """
    GET /api/v1/reports/activity/ - what happened on one day, in order.

    Backs the Time Snapshot screen ("what went on in this area between these
    hours") and the officer report's timeline ("what did this officer do
    today"). Same question, different filters.
    """

    permission_classes = [
        IsAuthenticated,
        IsSupervisor,
    ]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                description="Day to look at, YYYY-MM-DD.",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="from_time",
                description="Start of the window, HH:MM. Defaults to the start of the day.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="to_time",
                description="End of the window, HH:MM. Defaults to the end of the day.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="officer_id",
                description="Only what this officer took part in.",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="area_id",
                description="Only what happened in this area.",
                required=False,
                type=int,
            ),
        ],
        responses=ActivityRowSerializer(many=True),
    )
    def get(self, request):
        date, from_time, to_time, officer_id, area_id = activity_params(request)

        rows = activity.activity_feed(
            date=date,
            from_time=from_time,
            to_time=to_time,
            officer_id=officer_id,
            area_id=area_id,
        )

        return Response(ActivityRowSerializer(rows, many=True).data)


class OfficerReportView(APIView):
    """
    GET /api/v1/reports/officer/ - the page behind an officer's name.

    Day, week or custom range: the screen picks the span, this answers for it.
    """

    permission_classes = [
        IsAuthenticated,
        IsSupervisor,
    ]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="officer_id",
                description="The officer to report on.",
                required=True,
                type=int,
            ),
            OpenApiParameter(
                name="start_date",
                description="Start date, YYYY-MM-DD. Use the same day twice for a single day.",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="end_date",
                description="End date, YYYY-MM-DD.",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="status",
                description="Only missions with this status, in the history and the counts.",
                required=False,
                type=str,
            ),
        ],
        responses=OfficerReportSerializer,
    )
    def get(self, request):
        officer_id, start_date, end_date, status_filter = officer_report_params(request)

        report = services.generate_officer_report(
            officer_id=officer_id,
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter,
        )

        if report is None:
            return Response(
                {"detail": "Officer not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(OfficerReportSerializer(report).data)
