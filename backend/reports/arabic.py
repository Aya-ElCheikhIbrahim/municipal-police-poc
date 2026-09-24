"""
Arabic wording and PDF text drawing for the exported reports (CSV and  PDF).

The exports are always in Arabic, whatever the user's preffered_language:
the municipality reads its reports in Arabic. The JSON endpoints are unaffected;
the web dahsboard labels those itself.

reportlab draws characters exactly in the  order it iss given and cannot join
Arabic letters by itself, so PDF text goes through shape():

- arabic_reshaper swaps each letteer for itss joined (start/middle/end) form;
- python-bidi puts the line in visual order, right to left.

PDFs use Arabic-Indic digits and written months , CSV keep and sort them.

Badge number are identifiers and never converted. 
"""
import unicodedata
from datetime import date
from pathlib import Path

import arabic_reshaper
# python-bidi's original engine. The newer `from bidi import get_display` does
# not mirror brackets, which turned "(TP-20028)" into ")TP-20028(".
from bidi.algorithm import get_display
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONT = "Cairo"
FONT_BOLD = "Cairo-Bold"

RIGHT = 545

LABELS = {
    # Daily report
    "daily_title": "تقرير النشاط اليومي للعنصر",
    "officer": "العنصر",
    "officer_id": "رقم المستخدم",
    "date": "التاريخ",
    "hours_on_duty": "ساعات الخدمة",
    "distance_m": "المسافة المقطوعة (متر)",
    "missions_assigned": "المهام المسندة",
    "missions_completed": "المهام المنجزة",
    "missions_cancelled": "المهام الملغاة",
    "panic_events": "حالات الاستغاثة",
    "metric": "البند",
    "value": "القيمة",

    # Weekly summary
    "weekly_title": "التقرير الأسبوعي",
    "period": "الفترة",
    "from": "من",
    "to": "إلى",
    "start_date": "تاريخ البداية",
    "end_date": "تاريخ النهاية",
    "missions_by_priority": "المهام حسب الأولوية",
    "priority": "الأولوية",
    "count": "العدد",
    "missions_by_category": "المهام حسب النوع",
    "category": "النوع",
    "avg_ack": "متوسط وقت تأكيد الاستلام",
    "avg_completion": "متوسط وقت الإنجاز",
    "seconds": "ثانية",
    "top_officers": "العناصر الأكثر إنجازا",
    "completed_missions": "المهام المنجزة",
    "completed_count": "مهام منجزة",
    "no_completed_missions": "لا توجد مهام منجزة.",
}

CATEGORIES = {
    "Municipal": "بلدية",
    "Sanitation": "نظافة",
    "Traffic": "سير",
    "Infrastructure": "بنى تحتية",
}

PRIORITIES = {
    "low": "منخفضة",
    "medium": "متوسطة",
    "high": "مرتفعة",
    "urgent": "عاجلة",
}

MONTHS = [
    "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
    "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
]

_ARABIC_DIGITS = str.maketrans("0123456789.", "٠١٢٣٤٥٦٧٨٩٫")

def digits(value) -> str:
    """12.5 -> ١٢٫٥. For counts, hours and distances, never for badge numbers."""
    return str(value).translate(_ARABIC_DIGITS)


def written_date(day: date) -> str:
    """2026-09-19 -> ١٩ أيلول ٢٠٢٦"""
    return f"{digits(day.day)} {MONTHS[day.month - 1]} {digits(day.year)}"


def pdf_value(value) -> str:
    """How one report value reads in the PDF."""
    if isinstance(value, date):
        return written_date(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return digits(value)
    return str(value)


def daily_rows(report: dict) -> list:
    """(label, value) pairs of the daily report, in the order both exports use."""
    return [
        (LABELS["officer"], report["officer_name"]),
        (LABELS["officer_id"], report["officer_id"]),
        (LABELS["date"], report["date"]),
        (LABELS["hours_on_duty"], report["hours_on_duty"]),
        (LABELS["distance_m"], report["distance_covered_m"]),
        (LABELS["missions_assigned"], report["missions_assigned"]),
        (LABELS["missions_completed"], report["missions_completed"]),
        (LABELS["missions_cancelled"], report["missions_cancelled"]),
        (LABELS["panic_events"], report["panic_events"]),
    ]


def _register_fonts() -> None:
    """
    On first use rather than at import: a missing font file should break the
    PDF export only, not stop the whole API from starting.
    """
    if FONT not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT, FONT_DIR / "Cairo-Regular.ttf"))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, FONT_DIR / "Cairo-Bold.ttf"))


def shape(text) -> str:
    """Join the Arabic letters and put the line in right-to-left visual order."""
    _register_fonts()
    in_font = pdfmetrics.getFont(FONT).face.charToGlyph
    joined = arabic_reshaper.reshape(str(text))
    # Cairo has no separate glyph for a few stand-alone letter forms (ا ر ن ...).
    # A stand-alone letter looks exactly like the plain letter, which it has.
    joined = "".join(
        c if ord(c) in in_font else unicodedata.normalize("NFKC", c) for c in joined
    )
    return get_display(joined, base_dir="R")


def draw_line(pdf, y, text, *, size=11, bold=False, right=RIGHT) -> None:
    """One right-aligned line of Arabic (or mixed) text."""
    _register_fonts()
    pdf.setFont(FONT_BOLD if bold else FONT, size)
    pdf.drawRightString(right, y, shape(text))