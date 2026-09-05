from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import PanicEvent
from shifts.models import Shift

class PanicAlertView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # The PanicEvent model requires a shift link.
        shift = Shift.objects.filter(officer=user, status=Shift.Status.ACTIVE).first()
        if not shift:
            return Response(
                {"detail": "No active shift found. You must be on duty to trigger a panic alert."},
                status=status.HTTP_400_BAD_REQUEST
            )

        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        
        if latitude is None or longitude is None:
            return Response(
                {"detail": "Latitude and longitude are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the official PanicEvent
        panic_event = PanicEvent.objects.create(
            officer=user,
            shift=shift,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=request.data.get('accuracy_m'),
            battery_level=request.data.get('battery_level')
        )
        
        # Return the requested info in the response to confirm what was received
        return Response({
            "status": "Panic signal received",
            "id": panic_event.id,
            "username": user.username,
            "full_name": user.full_name,
            "badge_number": user.badge_number,
            "triggered_at": panic_event.triggered_at
        }, status=status.HTTP_201_CREATED)
