package com.thesis.bartwrapper.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.thesis.bartwrapper.validate.SyntaxError;

/**
 * The error body.
 * <p>
 * {@code location} names which part of the request body was at fault ("policy 2",
 * "context", "request") and {@code syntax} carries the source position when there is one.
 * Both are omitted from the JSON when null, so a plain error stays two fields.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String error, String detail, String location, SyntaxError syntax) {

    /** An error with neither a location nor a source position. */
    public static ApiError of(String error, String detail) {
        return new ApiError(error, detail, null, null);
    }
}
