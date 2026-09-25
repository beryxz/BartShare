package com.thesis.bartwrapper.validate;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * The outcome of checking arbitrary `.bart` text.
 * <p>
 * A rejection is this endpoint's finding, not a failed call: it travels as a 200 body with
 * {@code valid: false}, and {@code error} is omitted from the JSON when the text was fine.
 * </p>
 * <p>
 * Named {@code ok()}, not {@code valid()}, to avoid clashing with the record's own
 * {@code valid()} accessor.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ValidationResult(boolean valid, SyntaxError error) {

    public static ValidationResult ok() {
        return new ValidationResult(true, null);
    }

    public static ValidationResult invalid(SyntaxError error) {
        return new ValidationResult(false, error);
    }
}
