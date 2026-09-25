package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ParsersTest {

    @Test
    void validPolicyProducesContext() {
        var ctx = Parsers.policyFile("""
            (party:(username:"john"),
             rules:())
            """);
        assertThat(ctx.policy())
            .isNotNull();
    }

    /** Single-line on purpose: the message pins a position, which a line break would move. */
    @Test
    void syntaxErrorThrowsWithLineAndColumn() {
        var rulesWithoutParentheses = "(party:(username:\"john\"), rules:)";

        assertThatThrownBy(() -> Parsers.policyFile(rulesWithoutParentheses))
            .isInstanceOf(BartSyntaxException.class)
            .hasMessageContaining("line 1:");
    }

    @Test
    void unquotedValueIsRejected() {
        var unquotedUsername = "(party:(username:john), rules:())";

        assertThatThrownBy(() -> Parsers.policyFile(unquotedUsername))
            .isInstanceOf(BartSyntaxException.class);
    }
}
