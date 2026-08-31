import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from shifts.models import Shift

User = get_user_model()
officer_id = 1239

print(f"--- Checking Officer {officer_id} ---")
u = User.objects.filter(id=officer_id).first()
if u:
    print(f"User Found: {u.full_name} (Badge: {u.badge_number})")
    print(f"is_active: {u.is_active}")
    print(f"role: {u.role}")
else:
    print("User NOT found in database.")

s = Shift.objects.filter(officer_id=officer_id, status='active').first()
if s:
    print(f"Active Shift: ID {s.id}, Started at {s.started_at}")
else:
    print("No active shift found for this officer ID.")

print("\n--- Currently Active Officers ---")
active_shifts = Shift.objects.filter(status='active').select_related('officer')
for ashift in active_shifts:
    print(f"ID: {ashift.officer.id} | Name: {ashift.officer.full_name} | Started: {ashift.started_at}")
