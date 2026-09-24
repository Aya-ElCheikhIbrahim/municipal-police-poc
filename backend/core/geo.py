"""
Distance on the ground, shared by every app that has coordinates.

Kept in core because shifts (trails, nearby officers) and core (which area a
point falls in) both need it, and core must not import from an app above it.
No PostGIS at POC scale: the haversine formula is a few lines and accurate to
well under a metre over a city.
"""

import math

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))
