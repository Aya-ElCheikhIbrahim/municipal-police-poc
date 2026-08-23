package com.municipalpolice.officerapp.model;

import java.io.Serializable;

/** The signed-in officer. Mirrors what a /me endpoint would return later. */
public class Officer implements Serializable {
    private final String id;
    private final String fullName;
    private final String badgeNumber;

    public Officer(String id, String fullName, String badgeNumber) {
        this.id = id;
        this.fullName = fullName;
        this.badgeNumber = badgeNumber;
    }

    public String getId() { return id; }
    public String getFullName() { return fullName; }
    public String getBadgeNumber() { return badgeNumber; }
}
