"""
Field types shared by more than one app's serializers.
"""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from rest_framework import serializers


class CoordinateField(serializers.DecimalField):
    """
    A latitude or longitude, rounded to the stored precision instead of rejected.

    Android hands us whatever the GPS chip reports, which is typically seven
    decimal places (34.4319323). Every coordinate column is decimal(9, 6), and
    plain DecimalField answers the extra digit with a 400: "Ensure that there
    are no more than 6 decimal places."

    Six decimals is about 11 cm, so the precision beyond it is noise we do not
    want and would throw away on write anyway. Refusing the whole request over
    it is the wrong trade for a safety feature — a panic alert that 400s because
    the fix was too good is worse than an alert placed 11 cm off. So quantize
    here and let the request through.

    Only for input. The read-side serializers keep plain DecimalField: values
    coming out of the database are already at 6 places.
    """

    def __init__(self, max_digits=9, decimal_places=6, **kwargs):
        super().__init__(max_digits=max_digits, decimal_places=decimal_places, **kwargs)

    def to_internal_value(self, data):
        try:
            quantized = Decimal(str(data).strip()).quantize(
                Decimal(1).scaleb(-self.decimal_places), rounding=ROUND_HALF_UP
            )
        except (InvalidOperation, ValueError, TypeError, ArithmeticError):
            # Not a number at all, or too large to quantize. Hand the original
            # value to DRF so the client gets the standard error message for
            # what is actually wrong with it.
            return super().to_internal_value(data)
        return super().to_internal_value(quantized)
