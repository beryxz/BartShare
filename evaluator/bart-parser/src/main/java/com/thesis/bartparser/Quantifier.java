package com.thesis.bartparser;

/** The two quantifiers an {@code others} participant can carry. */
public enum Quantifier {

    ANY,
    ALL;

    /** Throws rather than defaulting, so a widened grammar cannot silently become {@code ALL}. */
    static Quantifier of(String token) {
        return switch (token) {
            case "any" -> ANY;
            case "all" -> ALL;
            default -> throw new IllegalStateException("unknown quantifier: " + token);
        };
    }
}
