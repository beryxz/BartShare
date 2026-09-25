package com.thesis.bartwrapper.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import com.thesis.bartparser.BartSyntaxException;
import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.ContextArityException;
import com.thesis.bartwrapper.InvalidRequesterException;
import com.thesis.bartwrapper.MissingInputException;

class EvaluationServiceTest {

    private static final String JOHN = """
        (party:(username:"john")(university:"unifi"),
         rules:(resource:(type:"lectureNotes")(course:"ads")))
        """;

    private static final String MARY = """
        (party:(username:"mary")(university:"unifi"),
         rules:())
        """;

    private static final String REQUEST = """
        2 : (resource:(type:"lectureNotes")(course:"ads"),
             from:(any:(username:"john")))
        """;

    /** Grants only while its own context allows it, so a leaked handler flips the verdict. */
    private static final String QUOTA_RULE = """
        (party:(username:"john"),
         rules:(resource:(type:"lectureNotes"), condition:(quota > 0)))
        """;

    private static final String QUOTA_REQUEST = """
        2 : (resource:(type:"lectureNotes"), from:(any:(username:"john")))
        """;

    private final EvaluationService service = new EvaluationService();

    private static String emptyTuple(int count) {
        return "(" + String.join(",", Collections.nCopies(count, "()")) + ")";
    }

    private static List<String> parties(int count) {
        return IntStream.rangeClosed(1, count)
            .mapToObj(i -> """
                (party:(username:"p%d"),
                 rules:())
                """.formatted(i))
            .toList();
    }

    // --- the happy path -----------------------------------------------------------------

    @Test
    void permitsAnUnconditionalGrantAndReportsTheSatisfiedRequest() {
        var response = service.evaluate(
            new EvaluationRequest(List.of(JOHN, MARY), "((),())", REQUEST));

        assertThat(response.permitted())
            .isTrue();
        assertThat(response.requests())
            .hasSize(1);
        assertThat(response.requests().get(0).requester())
            .isEqualTo(2);
        assertThat(response.requests().get(0).from())
            .isEqualTo(1);
        assertThat(response.requests().get(0).resource())
            .containsEntry("type", "lectureNotes")
            .containsEntry("course", "ads");
    }

    @Test
    void alwaysReturnsATraceBecauseADenialAndABuggyConditionLookTheSame() {
        var response = service.evaluate(
            new EvaluationRequest(List.of(JOHN, MARY), "((),())", REQUEST));

        assertThat(response.trace())
            .isNotBlank();
    }

    @Test
    void theScenarioFieldIsExactlyTheInputsConcatenatedInBartScenarioOrder() {
        var response = service.evaluate(
            new EvaluationRequest(List.of(JOHN, MARY), "((),())", REQUEST));

        assertThat(response.scenario())
            .isEqualTo(JOHN + "\n" + MARY + "\n" + "((),())" + "\n" + REQUEST + "\n");
    }

    // --- the party count is whatever the caller sent -------------------------------------

    @Test
    void evaluatesASinglePartySystem() {
        var response = service.evaluate(new EvaluationRequest(
            List.of(JOHN),
            "(())",
            """
                1 : (resource:(type:"lectureNotes")(course:"ads"), from:(any:))
                """));

        // Denied, not a crash: a 1-party system is accepted, but policiesToEvaluate
        // excludes the requester's own index, so from:(any:) has no candidate.
        assertThat(response.permitted())
            .isFalse();
    }

    @Test
    void acceptsARequesterIndexUpToTheNumberOfPoliciesSent() {
        var response = service.evaluate(new EvaluationRequest(
            parties(5),
            emptyTuple(5),
            """
                5 : (resource:(type:"anything"), from:(any:))
                """));

        // p1..p4 are rule-less, so nothing is granted, but the request being
        // accepted at all, at index 5, is the point.
        assertThat(response.permitted())
            .isFalse();
        assertThat(response.trace())
            .isNotBlank();
    }

    // --- required inputs ------------------------------------------------------------------

    @Test
    void aNullPolicyListIsRejected() {
        var noPolicies = new EvaluationRequest(null, "((),())", REQUEST);

        assertThatThrownBy(() -> service.evaluate(noPolicies))
            .isInstanceOfSatisfying(MissingInputException.class,
                e -> assertThat(e.getSlug())
                    .isEqualTo("empty-policies"));
    }

    @Test
    void anEmptyPolicyListIsRejected() {
        var emptyPolicies = new EvaluationRequest(List.of(), "()", REQUEST);

        assertThatThrownBy(() -> service.evaluate(emptyPolicies))
            .isInstanceOfSatisfying(MissingInputException.class,
                e -> assertThat(e.getSlug())
                    .isEqualTo("empty-policies"));
    }

    @Test
    void aNullElementInThePolicyListIsRejectedRatherThanCrashingTheParser() {
        var policies = new ArrayList<String>();
        policies.add(JOHN);
        policies.add(null);
        var withANullPolicy = new EvaluationRequest(policies, "((),())", REQUEST);

        assertThatThrownBy(() -> service.evaluate(withANullPolicy))
            .isInstanceOfSatisfying(MissingInputException.class,
                e -> assertThat(e.getSlug())
                    .isEqualTo("empty-policies"));
    }

    @Test
    void aBlankElementInThePolicyListIsRejectedWithAMissingInputSlug() {
        var policies = new ArrayList<String>();
        policies.add(JOHN);
        policies.add("   ");
        var withABlankPolicy = new EvaluationRequest(policies, "((),())", REQUEST);

        assertThatThrownBy(() -> service.evaluate(withABlankPolicy))
            .isInstanceOfSatisfying(MissingInputException.class,
                e -> assertThat(e.getSlug())
                    .isEqualTo("empty-policies"));
    }

    @Test
    void aBlankPolicyIsReportedByItsOneBasedPosition() {
        var policies = new ArrayList<String>();
        policies.add(JOHN);
        policies.add("   ");
        var withABlankPolicy = new EvaluationRequest(policies, "((),())", REQUEST);

        assertThatThrownBy(() -> service.evaluate(withABlankPolicy))
            .isInstanceOfSatisfying(MissingInputException.class,
                e -> assertThat(e.getMessage())
                    .startsWith("policy 2 is missing or blank"));
    }

    @Test
    void aBlankContextIsRejectedRatherThanTreatedAsAllEmpty() {
        var blankContext = new EvaluationRequest(List.of(JOHN, MARY), "   ", REQUEST);

        assertThatThrownBy(() -> service.evaluate(blankContext))
            .isInstanceOfSatisfying(MissingInputException.class,
                e -> assertThat(e.getSlug())
                    .isEqualTo("missing-context"));
    }

    @Test
    void aMissingRequestIsRejected() {
        var noRequest = new EvaluationRequest(List.of(JOHN, MARY), "((),())", null);

        assertThatThrownBy(() -> service.evaluate(noRequest))
            .isInstanceOfSatisfying(MissingInputException.class,
                e -> assertThat(e.getSlug())
                    .isEqualTo("missing-request"));
    }

    // --- malformed inputs, and the order they are reported in -----------------------------

    @Test
    void aMalformedPolicyIsReportedWithItsPartyPosition() {
        var broken = """
            (party:(username:"broken"), rules:)
            """;
        var brokenSecondPolicy = new EvaluationRequest(
            List.of(JOHN, broken), "((),())", REQUEST);

        assertThatThrownBy(() -> service.evaluate(brokenSecondPolicy))
            .isInstanceOfSatisfying(BartInputException.class, e -> {
                assertThat(e.getLocation())
                    .isEqualTo("policy 2");
                assertThat(e.getCause())
                    .isInstanceOf(BartSyntaxException.class);
            });
    }

    @Test
    void aContextWithTheWrongNumberOfListsIsRejected() {
        var oneListForTwoParties = new EvaluationRequest(List.of(JOHN, MARY), "(())", REQUEST);

        assertThatThrownBy(() -> service.evaluate(oneListForTwoParties))
            .isInstanceOf(ContextArityException.class);
    }

    @Test
    void aMalformedRequestIsReportedAsComingFromTheRequest() {
        var brokenRequest = new EvaluationRequest(
            List.of(JOHN, MARY), "((),())", "not a request");

        assertThatThrownBy(() -> service.evaluate(brokenRequest))
            .isInstanceOfSatisfying(BartInputException.class,
                e -> assertThat(e.getLocation())
                    .isEqualTo("request"));
    }

    /** The order is fixed and tested so error messages are reproducible. */
    @Test
    void aMalformedPolicyIsReportedBeforeAMalformedRequest() {
        var broken = """
            (party:(username:"broken"), rules:)
            """;
        var brokenPolicyAndRequest = new EvaluationRequest(
            List.of(broken), "(())", "not a request");

        assertThatThrownBy(() -> service.evaluate(brokenPolicyAndRequest))
            .isInstanceOfSatisfying(BartInputException.class,
                e -> assertThat(e.getLocation())
                    .isEqualTo("policy 1"));
    }

    /** Check 6 (arity) is only reachable once check 5 (context parses) has passed, so it must
     *  win over check 7 (request parses) too; pins the order beyond just "before the request". */
    @Test
    void aContextArityMismatchIsReportedBeforeAMalformedRequest() {
        var badArityAndBrokenRequest = new EvaluationRequest(
            List.of(JOHN, MARY), "(())", "not a request");

        assertThatThrownBy(() -> service.evaluate(badArityAndBrokenRequest))
            .isInstanceOf(ContextArityException.class);
    }

    /** Check 5 (context parses) fires before check 6 (arity) is even evaluated. */
    @Test
    void anUnparseableContextIsReportedBeforeItsArityIsChecked() {
        var brokenContextAndRequest = new EvaluationRequest(
            List.of(JOHN, MARY), "not a context", "not a request");

        assertThatThrownBy(() -> service.evaluate(brokenContextAndRequest))
            .isInstanceOfSatisfying(BartInputException.class,
                e -> assertThat(e.getLocation())
                    .isEqualTo("context"));
    }

    // --- the requester bound follows the policy count -------------------------------------

    @Test
    void aRequesterAboveThePolicyCountIsRejected() {
        var requesterThreeOfTwo = new EvaluationRequest(
            List.of(JOHN, MARY),
            "((),())",
            """
                3 : (resource:(type:"x"), from:(any:))
                """);

        assertThatThrownBy(() -> service.evaluate(requesterThreeOfTwo))
            .isInstanceOf(InvalidRequesterException.class)
            .hasMessageContaining("1..2");
    }

    /** Parties are 1-based, so the parser rejects this before the bound check can see it. */
    @Test
    void aRequesterOfZeroIsRejectedAtTheRequestParse() {
        var requesterZero = new EvaluationRequest(
            List.of(JOHN, MARY),
            "((),())",
            """
                0 : (resource:(type:"x"), from:(any:))
                """);

        assertThatThrownBy(() -> service.evaluate(requesterZero))
            .isInstanceOfSatisfying(BartInputException.class,
                e -> assertThat(e.getLocation())
                    .isEqualTo("request"));
    }

    // --- concurrency, the property the per-call construction exists for --------------------

    /**
     * Semantics mutates its trace and ContextHandler mutates its backing map on read, so state
     * hoisted out of the call would corrupt a neighbour rather than fail loudly. Every task runs
     * one policy text whose verdict comes only from its own context tuple, so a shared handler
     * surfaces as a verdict belonging to another task.
     */
    @Test
    void concurrentEvaluationsKeepTheirOwnContext() throws Exception {
        var permittedByIndex = IntStream.range(0, 64)
            .mapToObj(i -> i % 2 == 0)
            .toList();
        var work = permittedByIndex.stream()
            .map(permitted -> (Callable<Boolean>) () -> service.evaluate(new EvaluationRequest(
                List.of(QUOTA_RULE, MARY),
                permitted ? "((quota:1),())" : "((quota:0),())",
                QUOTA_REQUEST)).permitted())
            .toList();

        var pool = Executors.newFixedThreadPool(8);
        var verdicts = new ArrayList<Boolean>();
        try {
            for (var evaluated : pool.invokeAll(work)) {
                verdicts.add(evaluated.get());
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(verdicts)
            .isEqualTo(permittedByIndex);
    }
}
