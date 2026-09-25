package com.thesis.bartwrapper;

/**
 * Thrown when an enriched request names a requester above {@code policies.size()}. Maps to 400:
 * the parser rejects a non-positive index, but the party count belongs to the caller, and the
 * engine swallows the resulting {@code IndexOutOfBoundsException} as a denial, so an unchecked
 * typo would silently read as "access denied".
 */
public class InvalidRequesterException extends RuntimeException {

    public InvalidRequesterException(int requester, int partyCount) {
        super("Request has requester index " + requester
            + ", outside the valid range 1.." + partyCount
            + " for the " + partyCount + " policies supplied");
    }
}
