package com.thesis.bartparser;

/**
 * Thrown when a condition applies an operator to a value of the wrong type at evaluation time,
 * the evaluation-time counterpart of {@link BartSyntaxException}. {@code Semantics} catches
 * every exception from a condition and writes {@code getMessage()} to the trace as the deny
 * reason, so the message is the only diagnostic a policy author ever sees: keep it short.
 */
public class BartTypeException extends RuntimeException {
    public BartTypeException(String message) {
        super(message);
    }
}
