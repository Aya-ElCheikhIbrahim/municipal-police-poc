# Implementation Plan - Real Mission Synchronization

This plan describes how to connect the "Missions" feature across the backend, web dashboard, and Android app using a real database instead of hardcoded mock data.

## Proposed Changes

### 1. Backend: Data Persistence
We need to define the Mission data structure and expose it via a REST API.

#### [MODIFY] [models.py](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/backend/missions/models.py)
* Define `Mission` with fields: `title`, `description`, `latitude`, `longitude`, `priority`, `status`, `assigned_to`, `created_by`.
* Add `MissionPhoto` for future photo evidence support.

#### [NEW] [serializers.py](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/backend/missions/serializers.py)
* Create `MissionSerializer` to convert models to JSON and vice-versa.

#### [MODIFY] [views.py](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/backend/missions/views.py)
* Implement `MissionViewSet` to handle `GET` (list missions) and `POST` (create mission) requests.
* Ensure officers only see their own missions, while supervisors/dispatchers see everything.

#### [MODIFY] [urls.py](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/backend/missions/urls.py)
* Register the mission endpoints at `api/v1/missions/`.

#### [MODIFY] [admin.py](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/backend/missions/admin.py)
* Register `Mission` so it appears in the Django Admin web interface.

---

### 2. Web Dashboard: API Integration
The dashboard currently saves missions only in the browser's temporary memory (React state).

#### [MODIFY] [MainDashboard.tsx](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/web/src/MainDashboard.tsx)
* Replace the hardcoded `missions` state with data fetched from the backend on load.
* Update the "Create Mission" form to send a `POST` request to the backend.

---

### 3. Android App: Retrofit Integration
The app currently uses a `FakeMissionRepository` with static data.

#### [NEW] [MissionApiService.java](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/java/com/municipalpolice/officerapp/data/MissionApiService.java)
* Define the Retrofit interface for fetching missions.

#### [NEW] [RetrofitMissionRepository.java](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/java/com/municipalpolice/officerapp/data/RetrofitMissionRepository.java)
* Implement `MissionRepository` using real network calls.

#### [MODIFY] [MissionListActivity.java](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/java/com/municipalpolice/officerapp/ui/missions/MissionListActivity.java)
* Switch from `FakeMissionRepository` to the new `RetrofitMissionRepository`.

## Verification Plan

### Automated Tests
* Run `python manage.py test missions` to verify API logic.

### Manual Verification
1. **Create on Web**: Log into the Django Admin or Dashboard, create a new mission, and assign it to an officer.
2. **Check Database**: Verify the record exists in the PostgreSQL `missions_mission` table.
3. **Sync on Android**: Log into the Android app as that officer and verify the mission appears in the list.
4. **Update Status**: Acknowledge the mission on Android and verify the status changes to "Acknowledged" on the web dashboard.
