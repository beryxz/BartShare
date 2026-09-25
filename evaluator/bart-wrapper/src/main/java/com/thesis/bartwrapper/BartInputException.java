package com.thesis.bartwrapper;

import java.util.function.Supplier;

import com.thesis.bartparser.BartSyntaxException;

/**
 * A piece of the caller's `.bart` input that the parser or the model builder rejected, tagged
 * with which part of the request body it came from: the parser itself has no idea whether a
 * string was "policy 2" or "context", and this tag is what lets an error body say
 * {@code "location": "policy 2"}.
 */
public class BartInputException extends RuntimeException {

    private final String location;

    /** @param location where in the body the bad text was, e.g. {@code "policy 2"} */
    public BartInputException(String location, RuntimeException cause) {
        super(cause.getMessage(), cause);
        this.location = location;
    }

    public String getLocation() {
        return location;
    }

    /**
     * Runs a parse, tagging an authoring error with where its input came from: a parse failure
     * becomes a {@link BartSyntaxInputException}, a model-build failure ({@link
     * IllegalArgumentException} / {@link IllegalStateException}, e.g. a duplicate attribute key)
     * stays a {@link BartInputException}.
     * <p>
     * Anything else propagates as a 500, since catching bare {@code RuntimeException} would
     * report our own bugs as "your policy is invalid".
     * </p>
     */
    public static <T> T tagging(String location, Supplier<T> parse) {
        try {
            return parse.get();
        } catch (BartSyntaxException e) {
            throw new BartSyntaxInputException(location, e);
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw new BartInputException(location, e);
        }
    }
}
