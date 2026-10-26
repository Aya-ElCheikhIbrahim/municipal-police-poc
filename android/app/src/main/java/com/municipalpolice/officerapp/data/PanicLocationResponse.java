package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

/**
 * GET /api/v1/panic/{id}/location/ — where a colleague in panic is now.
 *
 * The position is their newest ping on that shift if it is newer than the
 * alert, otherwise the alert's own coordinates; recorded_at says which time
 * the position belongs to, so it is what the screen shows as "as of".
 */
public class PanicLocationResponse {
    @SerializedName("id")
    private int id;

    @SerializedName("officer")
    private Officer officer;

    // Decimal fields arrive as strings, as on PanicEventResponse.
    @SerializedName("latitude")
    private String latitude;

    @SerializedName("longitude")
    private String longitude;

    @SerializedName("accuracy_m")
    private Float accuracyM;

    @SerializedName("recorded_at")
    private String recordedAt;

    public int getId() { return id; }
    public Officer getOfficer() { return officer; }
    public String getLatitude() { return latitude; }
    public String getLongitude() { return longitude; }
    public Float getAccuracyM() { return accuracyM; }
    public String getRecordedAt() { return recordedAt; }

    public static class Officer {
        @SerializedName("id")
        private int id;
        @SerializedName("full_name")
        private String fullName;
        @SerializedName("badge_number")
        private String badgeNumber;
        // "" when the officer has no number on file.
        @SerializedName("phone")
        private String phone;

        public int getId() { return id; }
        public String getFullName() { return fullName; }
        public String getBadgeNumber() { return badgeNumber; }
        public String getPhone() { return phone; }
    }
}
