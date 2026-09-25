package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import bart.core.semantics.Semantics;

/**
 * Set literals at {@code .bart} text level: {@code {...}} is the only set syntax, so
 * {@code (friends:"mary")} is the String "mary", and {@code in} over it denies with the type
 * named in the trace rather than silently.
 */
class SetLiteralScenarioTest {

    private static final String PS = """
        (party:(username:"john"),
         rules:(resource:(type:"exercises"),
                condition:(requester.username in friends)))
        (party:(username:"mary"),
         rules:())
        """;

    private static final String REQUEST = """
        2 : (resource:(type:"exercises"),
             from:(any:(username:"john")))
        """;

    private static final String TAGGED_PS = """
        (party:(username:"john"),
         rules:(resource:(type:"notes")(tags:{"a","b"})))
        (party:(username:"mary"),
         rules:())
        """;

    /** Verdict plus trace from one evaluation; several tests below assert on the trace too. */
    private record Outcome(boolean permitted, String trace) {}

    private static Outcome evaluate(String policySystem, String context, String request) {
        Scenario sc = Bart.parseScenario(policySystem + "\n" + context + "\n" + request);
        Semantics semantics = new Semantics(sc.policies()).contextHandler(sc.context());
        boolean permitted = semantics.evaluate(sc.request()).isPermitted();
        return new Outcome(permitted, semantics.getTrace().toString());
    }

    @Test
    void aSingletonSetIsARealSetSoMembershipHolds() {
        var context = """
            (
              (friends:{"mary"}),
              ()
            )
            """;

        assertThat(evaluate(PS, context, REQUEST).permitted())
            .isTrue();
    }

    @Test
    void anEmptySetDeniesWithoutError() {
        // an empty set is a real set with no members: a plain false, no type error
        var context = """
            (
              (friends:{}),
              ()
            )
            """;

        Outcome o = evaluate(PS, context, REQUEST);
        assertThat(o.permitted())
            .isFalse();
        assertThat(o.trace())
            .doesNotContain("not a set");
    }

    @Test
    void aScalarIsATypeErrorThatDeniesAndSaysSoInTheTrace() {
        var context = """
            (
              (friends:"mary"),
              ()
            )
            """;

        Outcome o = evaluate(PS, context, REQUEST);

        assertThat(o.permitted())
            .isFalse();
        assertThat(o.trace())
            .contains("in: friends is a String, not a set");
        assertThat(o.trace())
            .doesNotContain("Cannot cast");
    }

    /**
     * The same fail-closed-but-legible treatment as 'in'. A set has no ordering, so '<' over one
     * is a type error in the policy; the rule still denies, but the trace names the problem.
     */
    @Test
    void comparingASetDeniesAndExplainsItselfInTheTrace() {
        String ps = """
            (party:(username:"john"),
             rules:(resource:(type:"exercises"),
                    condition:(friends < "x")))
            (party:(username:"mary"),
             rules:())
            """;

        var context = """
            (
              (friends:{"a","b"}),
              ()
            )
            """;

        Outcome o = evaluate(ps, context, REQUEST);

        assertThat(o.permitted())
            .isFalse();
        assertThat(o.trace())
            .contains("cannot compare set with String");
        assertThat(o.trace())
            .doesNotContain("Cannot cast");
    }

    /**
     * The left operand of 'in' is an atom, so a set there is a type error like a scalar on the
     * right. Without the check the engine's List.contains would answer false for a set element,
     * and 'not' would turn that into a permit.
     */
    @Test
    void aSetOnTheLeftOfMembershipDeniesInsteadOfPermittingThroughNot() {
        String ps = """
            (party:(username:"john"),
             rules:(resource:(type:"exercises"),
                    condition:(not (friends in allow))))
            (party:(username:"mary"),
             rules:())
            """;

        var context = """
            (
              (friends:{"x","y"})(allow:{"x"}),
              ()
            )
            """;

        Outcome o = evaluate(ps, context, REQUEST);

        assertThat(o.permitted())
            .isFalse();
        assertThat(o.trace())
            .contains("in: friends is a set, not a set element");
    }

    /**
     * The multiset property, end to end. AttributeMatcher lives in the read-only fork and
     * compares values with Objects.equals, so the only way to make a reordered set match is to
     * canonicalise before the value ever reaches the engine.
     */
    @Test
    void aRequestWhoseSetIsWrittenInAnotherOrderStillMatchesTheRulePattern() {
        String request = """
            2 : (resource:(type:"notes")(tags:{"b","a"}),
                 from:(any:(username:"john")))
            """;

        assertThat(evaluate(TAGGED_PS, "((),())", request).permitted())
            .isTrue();
    }
}
