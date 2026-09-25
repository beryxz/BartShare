package com.thesis.bartwrapper;

/**
 * A required part of the {@code /evaluate} body was absent or blank. Maps to 400. Carries its
 * own error slug so a caller debugging a generated body knows which field it got wrong.
 */
public class MissingInputException extends RuntimeException {

    private final String slug;

    /** @param slug the API error slug: {@code empty-policies}, {@code missing-context}, {@code missing-request} */
    public MissingInputException(String slug, String detail) {
        super(detail);
        this.slug = slug;
    }

    public String getSlug() {
        return slug;
    }
}
