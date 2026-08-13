"""
core/permissions.py

    Role checks used by every app. Required in sectionn 5: RBAC enforced server side never trust the client
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsOfficer (BasePermission):
    message = "Only officers can perform this action."

    def has_permission  (self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated

            and request.user.is_officer
        )

class IsDispatcher(BasePermission):
    message= "Only dispatchers can perform this action."

    def has_permission (self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_dispatcher
        )

class IsSupervisor (BasePermission):
    message ="Only supervisors can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_supervisor
        )

class IsDispatcherOrSupervisor(BasePermission):
    message = "Dachboard access reequires a dispatcher or supervisor"

    def has_permission(self, request, view):
        user = request.user
        return bool (
            user
            and user.is_authenticated
            and (user.is_dispatcher or user.is_supervisor)
        )

class IsSupervisorOrReadOnly(BasePermission):

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.is_supervisor