package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.antlr.v4.runtime.BaseErrorListener;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.RecognitionException;
import org.antlr.v4.runtime.Recognizer;
import org.junit.jupiter.api.Test;

class GrammarSmokeTest {

    private static String resource(String name) throws Exception {
        try (var in = GrammarSmokeTest.class.getResourceAsStream("/scenarios/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static List<String> parseErrors(String text) {
        var errors = new ArrayList<String>();
        var listener = new BaseErrorListener() {
            @Override
            public void syntaxError(Recognizer<?, ?> r, Object sym, int line, int col,
                String msg, RecognitionException e) {
                errors.add("line " + line + ":" + col + " " + msg);
            }
        };
        var lexer = new BartLexer(CharStreams.fromString(text));
        lexer.removeErrorListeners();
        lexer.addErrorListener(listener);
        var parser = new BartParser(new CommonTokenStream(lexer));
        parser.removeErrorListeners();
        parser.addErrorListener(listener);
        parser.scenarioFile();
        return errors;
    }

    @Test
    void ex1ParsesWithoutErrors() throws Exception {
        assertThat(parseErrors(resource("ex1_basic.bart")))
            .isEmpty();
    }

    @Test
    void ex2ParsesWithoutErrors() throws Exception {
        assertThat(parseErrors(resource("ex2_basic_plus_cycle.bart")))
            .isEmpty();
    }

    @Test
    void ex3ParsesWithoutErrors() throws Exception {
        assertThat(parseErrors(resource("ex3_multi_party_exchange.bart")))
            .isEmpty();
    }

    /**
     * Pins documented deviation #7 (Bart.g4): {@code {...}} is legal only in attribute-value
     * position, not inside a condition. A future edit to expr/atom must not quietly admit it.
     */
    @Test
    void braceSetLiteralInConditionIsStillASyntaxError() {
        var braceSetInCondition = """
            (party:(username:"john"),
             rules:(resource:(type:"x"),
                    condition:(requester.username in {"a","b"})))
            """;

        assertThatThrownBy(() -> Parsers.policyFile(braceSetInCondition))
            .isInstanceOf(BartSyntaxException.class);
    }
}
