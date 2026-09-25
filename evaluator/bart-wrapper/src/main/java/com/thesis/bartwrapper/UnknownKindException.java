package com.thesis.bartwrapper;

/**
 * Thrown when {@code /validate/{kind}} names something that is not a grammar entry rule.
 * Maps to 404, since the path addresses a validator that does not exist.
 */
public class UnknownKindException extends RuntimeException {

    public UnknownKindException(String slug) {
        super("Unknown artifact kind '" + slug
            + "'; expected one of policy-system, policy, context, request");
    }
}
