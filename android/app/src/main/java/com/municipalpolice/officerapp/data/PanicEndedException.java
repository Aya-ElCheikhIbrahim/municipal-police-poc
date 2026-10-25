package com.municipalpolice.officerapp.data;

/**
 * The location endpoint answered 404: the alert is no longer active (cancelled
 * or resolved), which the backend documents as "the incident is over, stop
 * following". A type of its own so the screen can tell it apart from a dead
 * zone, which is temporary and must keep polling.
 */
public class PanicEndedException extends Exception {
    public PanicEndedException(int panicId) {
        super("Panic alert " + panicId + " is no longer active");
    }
}
