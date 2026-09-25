package com.thesis.bartparser;

/**
 * Thrown when `.bart` text fails to lex or parse. Carries the source position as addressable
 * fields, mirroring ANTLR's own line/column convention unchanged, as well as inside
 * {@link #getMessage()}, so a consumer can place an editor diagnostic without re-parsing the
 * formatted string.
 */
public class BartSyntaxException extends RuntimeException {

    private final Integer line;
    private final Integer column;
    private final String rawMessage;

    /** For a failure that has no source position; {@code line} and {@code column} stay null. */
    public BartSyntaxException(String message) {
        super(message);
        this.line = null;
        this.column = null;
        this.rawMessage = message;
    }

    /** Populates the fields as well as the formatted {@link #getMessage()}. */
    public BartSyntaxException(int line, int column, String rawMessage) {
        super("line " + line + ":" + column + " " + rawMessage);
        this.line = line;
        this.column = column;
        this.rawMessage = rawMessage;
    }

    /** 1-based source line, or null when the failure carries no position. */
    public Integer getLine() {
        return line;
    }

    /** 0-based character position within the line, or null when there is no position. */
    public Integer getColumn() {
        return column;
    }

    /** The message without the {@code "line L:C "} prefix. */
    public String getRawMessage() {
        return rawMessage;
    }
}
