package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class BartSyntaxExceptionTest {

    /** A context tuple missing its closing paren: ANTLR reports it at line 1, column 17. */
    private static final String UNCLOSED_CONTEXT = "((friends:\"a\"),()";

    @Test
    void aParseErrorCarriesAntlrsPositionAsFields() {
        assertThatThrownBy(() -> Bart.parseContext(UNCLOSED_CONTEXT))
            .isInstanceOfSatisfying(BartSyntaxException.class, e -> {
                assertThat(e.getLine())
                    .isEqualTo(1);
                assertThat(e.getColumn())
                    .isEqualTo(17);
                assertThat(e.getRawMessage())
                    .contains("extraneous input");
            });
    }

    @Test
    void theRawMessageOmitsThePositionPrefix() {
        assertThatThrownBy(() -> Bart.parseContext(UNCLOSED_CONTEXT))
            .isInstanceOfSatisfying(BartSyntaxException.class,
                e -> assertThat(e.getRawMessage())
                    .doesNotContain("line 1:"));
    }

    /**
     * The formatted message is what every existing caller reads, so it must stay exactly
     * "line L:C raw": the fields must not change a single byte of it.
     */
    @Test
    void getMessageIsStillThePositionPrefixFollowedByTheRawMessage() {
        assertThatThrownBy(() -> Bart.parseContext(UNCLOSED_CONTEXT))
            .isInstanceOfSatisfying(BartSyntaxException.class,
                e -> assertThat(e.getMessage())
                    .isEqualTo(
                        "line " + e.getLine() + ":" + e.getColumn() + " " + e.getRawMessage()));
    }

    @Test
    void anExceptionRaisedWithoutAPositionReportsNullLineAndColumn() {
        var e = new BartSyntaxException("no position for this one");

        assertThat(e.getLine())
            .isNull();
        assertThat(e.getColumn())
            .isNull();
        assertThat(e.getRawMessage())
            .isEqualTo("no position for this one");
        assertThat(e.getMessage())
            .isEqualTo("no position for this one");
    }
}
