"""
Which area a point falls in.

Called when a mission is created, and by the reports when they group activity
by district. Deliberately a plain function over a handful of rows: a city has
tens of areas, not thousands, so a query plus a loop is cheaper than the
machinery to avoid it.
"""

from .geo import haversine_m
from .models import Area


def area_for(latitude, longitude):
    """
    The nearest active area whose circle contains the point, or None when the
    point is outside every area. None is a real answer, not an error: a mission
    on the edge of town belongs to no district.
    """
    if latitude is None or longitude is None:
        return None

    point = (float(latitude), float(longitude))
    best, best_distance = None, None

    for area in Area.objects.filter(is_active=True):
        distance = haversine_m(
            point[0], point[1], float(area.latitude), float(area.longitude)
        )
        if distance <= area.radius_m and (best_distance is None or distance < best_distance):
            best, best_distance = area, distance

    return best
