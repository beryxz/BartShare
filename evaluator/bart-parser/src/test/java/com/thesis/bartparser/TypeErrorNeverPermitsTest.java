package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import bart.core.Policies;
import bart.core.Request;
import bart.core.semantics.Semantics;

/**
 * The invariant, pinned at `.bart` text level: no type error the condition <em>evaluates</em>
 * produces a permit. The engine swallows a condition exception as a deny, so throwing is safe
 * and returning a value is not: a type error degrading to {@code false} permits once
 * {@code not} negates it. Short-circuiting bounds the invariant: an operand {@code and} or
 * {@code or} skips is never typed at all. Cases cross one context name per type against the
 * ordering operators and {@code in}; {@code =} and {@code !=} are total, so they cannot fail.
 */
class TypeErrorNeverPermitsTest {

    private static final String GRANTOR = """
        (party:(username:"john"),
         rules:(resource:(type:"exercises"), condition:(%s)))
        """;

    private static final String REQUESTER = """
        (party:(username:"mary"),
         rules:())
        """;

    /** Party 1 carries one value of every type a name can resolve to; party 2 carries none. */
    private static final String CONTEXT = """
        (
          (owner:"john")(count:7)(ratio:1.5)(flag:true)(friends:{"x","y"})(allow:{"x"}),
          ()
        )
        """;

    private static final String REQUEST = """
        2 : (resource:(type:"exercises"),
             from:(any:(username:"john")))
        """;

    /** Every nesting the erroneous expression is placed in; each one evaluates it. */
    private static final List<String> NESTINGS = List.of(
        "%s",
        "not (%s)",
        "not (not (%s))",
        "(%s) and true",
        "true and (%s)",
        "(%s) or false",
        "false or (%s)");

    private static final List<String> ORDERING_OPS = List.of("<", ">", "<=", ">=");

    /** One constant per type a name resolves to, carrying the word the diagnostics use for it. */
    private enum ValueType {
        STRING("String"), LONG("Long"), DOUBLE("Double"), BOOLEAN("Boolean"), SET("set");

        private final String diagnosticName;

        ValueType(String diagnosticName) {
            this.diagnosticName = diagnosticName;
        }
    }

    /** A context name and its type, the two things the cross products filter on. */
    private record Operand(String name, ValueType type) {
        boolean isSet() {
            return type == ValueType.SET;
        }
    }

    private static final List<Operand> OPERANDS = List.of(
        new Operand("owner", ValueType.STRING),
        new Operand("count", ValueType.LONG),
        new Operand("ratio", ValueType.DOUBLE),
        new Operand("flag", ValueType.BOOLEAN),
        new Operand("friends", ValueType.SET));

    private static final Operand ALLOW = new Operand("allow", ValueType.SET);

    /** An ill-typed condition and the fragment of the diagnostic that must reach the trace. */
    private record TypeError(String expr, String fragment) {
        @Override
        public String toString() {
            return expr;
        }
    }

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
    @MethodSource("typeErrors")
    void noTypeErrorPermitsUnderAnyNesting(TypeError error) {
        for (String nesting : NESTINGS) {
            String condition = nesting.formatted(error.expr());
            Outcome outcome = evaluate(condition);
            assertThat(outcome.permitted())
                .as("%s", condition)
                .isFalse();
            assertThat(outcome.trace())
                .as("%s", condition)
                .contains(error.fragment());
        }
    }

    static Stream<TypeError> typeErrors() {
        return Stream.of(
            orderingErrors(),
            membershipErrors(),
            nonBooleanConditions(),
            qualifiedNameErrors())
            .flatMap(s -> s);
    }

    /** Ordering is defined between two atoms of one type, so every other pairing is an error. */
    private static Stream<TypeError> orderingErrors() {
        return ORDERING_OPS.stream()
            .flatMap(op -> OPERANDS.stream()
                .flatMap(left -> OPERANDS
                    .stream()
                    .filter(right -> left.isSet() || right.isSet() || left.type() != right.type())
                    .map(right -> new TypeError(
                        left.name() + " " + op + " " + right.name(), "cannot compare"))));
    }

    /**
     * Both operands are context names because the grammar admits only a name right of {@code in}.
     * A non-set right operand is inspected first, so when both sides are wrong the fragment names
     * the right one by its actual type: that pins the inspection order, which a bare "not a set"
     * would not, being a prefix of "not a set element".
     */
    private static Stream<TypeError> membershipErrors() {
        return Stream.concat(OPERANDS.stream(), Stream.of(ALLOW))
            .flatMap(set -> OPERANDS.stream()
                .filter(element -> !set.isSet() || element.isSet())
                .map(element -> new TypeError(
                    element.name() + " in " + set.name(),
                    set.isSet()
                        ? "not a set element"
                        : "is a " + set.type().diagnosticName + ", not a set")));
    }

    private static Stream<TypeError> nonBooleanConditions() {
        return Stream.concat(
            OPERANDS.stream().filter(o -> o.type() != ValueType.BOOLEAN).map(Operand::name),
            Stream.of("\"text\"", "7", "1.5"))
            .map(expr -> new TypeError(expr, "is not a condition"));
    }

    /** The other two name forms resolve through the same typing, so they fail the same way. */
    private static Stream<TypeError> qualifiedNameErrors() {
        return Stream.of(
            new TypeError("requester.username", "is not a condition"),
            new TypeError("(username:\"john\").owner", "is not a condition"),
            new TypeError("requester.username in owner", "is a String, not a set"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("wellTypedPermits")
    void aWellTypedConditionStillPermits(String condition) {
        assertThat(evaluate(condition).permitted())
            .isTrue();
    }

    static Stream<String> wellTypedPermits() {
        return Stream.of(
            "2023 < 2024",
            "\"a\" = \"a\"",
            "owner = \"john\"",
            "count < 8",
            "ratio < 2.0",
            "\"x\" in friends",
            "owner in allow or \"x\" in friends",
            "true",
            "flag",
            "not false",
            "not (\"z\" in friends)",
            "flag and 2023 < 2024");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("wellTypedDenials")
    void aWellTypedConditionThatIsFalseDeniesWithoutATypeError(String condition) {
        Outcome outcome = evaluate(condition);
        assertThat(outcome.permitted())
            .isFalse();
        assertThat(outcome.trace())
            .doesNotContain("not a set", "is not a condition", "cannot compare");
    }

    static Stream<String> wellTypedDenials() {
        return Stream.of(
            "2024 < 2023",
            "\"z\" in friends",
            "owner = \"mary\"",
            "false",
            "not true");
    }

    /** The over-correction canary: a legitimate false negated is a permit, not a type error. */
    @Test
    void anAbsentAtomNegatedByNotStillPermits() {
        Outcome outcome = evaluate("not (owner in allow)");

        assertThat(outcome.permitted())
            .isTrue();
        assertThat(outcome.trace())
            .doesNotContain("not a set element");
    }

    @Test
    void aStringNegatedByNotDeniesInsteadOfGrantingAccess() {
        Outcome outcome = evaluate("not owner");

        assertThat(outcome.permitted())
            .isFalse();
        assertThat(outcome.trace())
            .contains("is not a condition");
    }

    @Test
    void aSetLeftOfMembershipNegatedByNotDeniesInsteadOfGrantingAccess() {
        Outcome outcome = evaluate("not (friends in allow)");

        assertThat(outcome.permitted())
            .isFalse();
        assertThat(outcome.trace())
            .contains("not a set element");
    }
}
