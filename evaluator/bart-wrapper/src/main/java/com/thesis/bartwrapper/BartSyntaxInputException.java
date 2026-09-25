package com.thesis.bartwrapper;

import com.thesis.bartparser.BartSyntaxException;

/**
 * Tagged input that failed to <em>parse</em>, so it has a source position. The sibling case,
 * text that parsed but would not build a model, has none and stays a plain
 * {@link BartInputException}.
 */
public final class BartSyntaxInputException extends BartInputException {

    private final BartSyntaxException syntaxError;

    public BartSyntaxInputException(String location, BartSyntaxException cause) {
        super(location, cause);
        this.syntaxError = cause;
    }

    public BartSyntaxException getSyntaxError() {
        return syntaxError;
    }
}
