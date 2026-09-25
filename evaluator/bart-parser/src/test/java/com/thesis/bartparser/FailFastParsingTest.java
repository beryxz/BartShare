package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

/**
 * The parser is fail-fast and silent: a lex error throws exactly as a parse error does, every
 * entry rule rejects trailing input, and a failed parse writes nothing to the console.
 */
class FailFastParsingTest {

    private static final String POLICY = """
        (party:(username:"john"),
         rules:())
        """;

    private static final String CONTEXT = """
        ((friends:"david"))
        """;
    private static final String REQUEST = """
        1 : (resource:(type:"ln"),
             from:(any:(degreeProgram:"cs")))
        """;
    private static final String SCENARIO = POLICY + "\n" + CONTEXT + "\n" + REQUEST;

    /**
     * '@' matches no lexer rule, and it sits where deleting it would leave valid input. That
     * placement is the point: without the lexer's throwing listener, ANTLR's default recovery
     * skips the character and the parse succeeds, so a stray '@' elsewhere would still throw
     * from the parser and prove nothing.
     */
    @Test
    void aLexErrorThrowsRatherThanBeingSkipped() {
        assertThatThrownBy(() -> Parsers.policyFile("(party:(username:\"john\")@, rules:())"))
            .isInstanceOfSatisfying(BartSyntaxException.class,
                e -> assertThat(e.getLine())
                    .isEqualTo(1));
    }

    /**
     * Without the lexer's throwing listener, the lexer skips the opening quote and the parser
     * fails later at a different column, so the position is what proves this is a lex error
     * rather than a parse error recovering downstream.
     */
    @Test
    void anUnterminatedStringIsALexErrorToo() {
        assertThatThrownBy(() -> Parsers.policyFile("(party:(username:\"john), rules:())"))
            .isInstanceOfSatisfying(BartSyntaxException.class, e -> {
                assertThat(e.getLine())
                    .isEqualTo(1);
                assertThat(e.getColumn())
                    .isEqualTo(17);
            });
    }

    /**
     * Capturing the streams is only safe because Surefire runs this module single-threaded; do
     * not enable parallel execution.
     */
    @Test
    void aFailedParseWritesNothingToTheConsole() {
        var out = new ByteArrayOutputStream();
        var err = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;
        System.setOut(new PrintStream(out, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(err, true, StandardCharsets.UTF_8));
        try {
            // one lex error and one parse error: each has its own console listener to remove
            assertThatThrownBy(() -> Parsers.policyFile("(party:(username:@), rules:())"))
                .isInstanceOf(BartSyntaxException.class);
            assertThatThrownBy(() -> Parsers.policyFile("(party:(username:\"john\"), rules:)"))
                .isInstanceOf(BartSyntaxException.class);
        } finally {
            System.setOut(originalOut);
            System.setErr(originalErr);
        }
        assertThat(out.toString(StandardCharsets.UTF_8))
            .isEmpty();
        assertThat(err.toString(StandardCharsets.UTF_8))
            .isEmpty();
    }

    /** The EOF anchor is what makes an over-long parse an error instead of a silent prefix. */
    @Test
    void everyEntryRuleRejectsTrailingInput() {
        assertThatThrownBy(() -> Parsers.policyFile(POLICY + " zzz"))
            .isInstanceOf(BartSyntaxException.class);
        assertThatThrownBy(() -> Parsers.policySystemFile(POLICY + " zzz"))
            .isInstanceOf(BartSyntaxException.class);
        assertThatThrownBy(() -> Parsers.contextFile(CONTEXT + " zzz"))
            .isInstanceOf(BartSyntaxException.class);
        assertThatThrownBy(() -> Parsers.enrichedRequestFile(REQUEST + " zzz"))
            .isInstanceOf(BartSyntaxException.class);
        assertThatThrownBy(() -> Parsers.scenarioFile(SCENARIO + " zzz"))
            .isInstanceOf(BartSyntaxException.class);
    }
}
