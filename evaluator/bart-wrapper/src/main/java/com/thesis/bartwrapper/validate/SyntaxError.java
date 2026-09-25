package com.thesis.bartwrapper.validate;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.thesis.bartparser.BartSyntaxException;

/**
 * Where and why a piece of `.bart` text was rejected.
 * <p>
 * {@code line} is 1-based, {@code column} is 0-based (ANTLR's own convention), passed through
 * unchanged so an editor can place a caret without arithmetic. Both are null for a model-build
 * error (e.g. duplicate attribute key), which has no token to point at.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SyntaxError(Integer line, Integer column, String message) {

    public static SyntaxError of(BartSyntaxException e) {
        return new SyntaxError(e.getLine(), e.getColumn(), e.getRawMessage());
    }

    public static SyntaxError withoutPosition(String message) {
        return new SyntaxError(null, null, message);
    }
}
