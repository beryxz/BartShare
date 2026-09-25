package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import bart.core.Policies;
import bart.core.Request;
import bart.core.semantics.Semantics;

/**
 * Characterisation of a deliberate decision, not a statement of what is wanted. {@code =},
 * {@code !=} and {@code in} all answer through record equality, so they are total across types
 * where ordering throws: each row below is false, and so permits under {@code not}, with nothing
 * in the trace to say why. Pinned so that changing equality, or giving Long and Double a shared
 * numeric domain, has to change a test rather than shift behaviour silently.
 */
class CrossTypeEqualityIsTotalTest {

    private static final String GRANTOR = """
        (party:(username:"john"),
         rules:(resource:(type:"exercises"), condition:(%s)))
        """;

    private static final String REQUESTER = """
        (party:(username:"mary"),
         rules:())
        """;

    /** Party 1 holds the same 7 three ways, as a Long, a String and members of two sets. */
    private static final String CONTEXT = """
        (
          (owner:"john")(count:7)(ratio:1.5)(text:"7")(nums:{7})(dnums:{7.0})(friends:{"x","y"}),
          ()
        )
        """;

    private static final String REQUEST = """
        2 : (resource:(type:"exercises"),
             from:(any:(username:"john")))
        """;

    private record Outcome(boolean permitted, String trace) {}

    private static Outcome evaluate(String condition) {
        Policies policies = new Policies()
            .add(Bart.parsePolicy(GRANTOR.formatted(condition)))
            .add(Bart.parsePolicy(REQUESTER));
        Semantics semantics = new Semantics(policies).contextHandler(Bart.parseContext(CONTEXT));
        Request request = Bart.parseEnrichedRequest(REQUEST);
        boolean permitted = semantics.evaluate(request).isPermitted();
        return new Outcome(permitted, semantics.getTrace().toString());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("crossTypeComparisons")
    void aCrossTypeComparisonIsFalseAndSoReachesAPermit(String condition) {
        Outcome outcome = evaluate(condition);

        assertThat(outcome.permitted())
            .isTrue();
        assertThat(outcome.trace())
            .doesNotContain("not a set", "cannot compare");
    }

    static Stream<String> crossTypeComparisons() {
        return Stream.of(
            "not (owner = count)", // String against Long
            "not (count = ratio)", // Long against Double
            "friends != owner", // set against String
            "not (count in dnums)", // 7 is not a member of {7.0}
            "not (text in nums)"); // "7" is not a member of {7}
    }

    /**
     * The control: within one type these operators answer true, so the rows above are blindness.
     */
    @Test
    void withinOneTypeTheSameOperatorsStillAnswerTrue() {
        assertThat(evaluate("count in nums").permitted())
            .isTrue();
        assertThat(evaluate("owner = \"john\"").permitted())
            .isTrue();
        assertThat(evaluate("count = 7").permitted())
            .isTrue();
    }
}
