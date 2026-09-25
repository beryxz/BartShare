package com.thesis.bartwrapper;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.thesis.bartparser.Bart;

/** Proves the bart-parser dependency (and bart.core transitively) is on the classpath. */
class BartParserDependencyTest {

    @Test
    void parsesTheMinimalSeedPolicy() {
        var source = """
            (party:(username:"p1"),
             rules:())
            """;
        var policy = Bart.parsePolicy(source);

        assertThat(policy.party().name("username"))
            .isEqualTo("p1");
    }
}
