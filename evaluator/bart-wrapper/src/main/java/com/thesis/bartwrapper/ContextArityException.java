package com.thesis.bartwrapper;

/**
 * Thrown when the context tuple does not carry exactly one attribute list per policy. Maps to
 * 400: tolerating a mismatch would shift every later party's attributes by one and produce a
 * wrong permit/deny instead of an error.
 */
public class ContextArityException extends RuntimeException {

    public ContextArityException(int actual, int expected) {
        super("context has " + actual + " attribute list(s) but " + expected
            + " policies were given; there must be exactly one list per party");
    }
}
