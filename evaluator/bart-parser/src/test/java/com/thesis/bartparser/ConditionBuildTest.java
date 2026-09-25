package com.thesis.bartparser;

import static com.thesis.bartparser.TestPolicies.firstRule;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import bart.core.ExpressionCode;
import bart.core.Rule;

class ConditionBuildTest {

    private static final FakeResolver NO_NAMES = new FakeResolver(Map.of());

    private static final String POLICY = """
        (party:(username:"j"),
         rules:(resource:(type:"x"),
                condition:(%s)))
        """;

    private static ExpressionCode conditionOf(String condition) {
        return firstRule(POLICY.formatted(condition)).getCondition();
    }

    /** Friends is an Object so a test can bind it to a scalar and watch the type error. */
    private static FakeResolver requesterAndFriends(String requester, Object friends) {
        return new FakeResolver(Map.of("requester.username", requester, "friends", friends));
    }

    @Test
    void inConditionEvaluatesAndCarriesDescription() throws Exception {
        ExpressionCode cond = conditionOf("requester.username in friends");
        var aFriend = requesterAndFriends("david", List.of("ashley", "david"));
        var aStranger = requesterAndFriends("mary", List.of("ashley", "david"));

        assertThat(cond.toString())
            .isEqualTo("requester.username in friends");
        assertThat(cond.evaluate(aFriend))
            .isTrue();
        assertThat(cond.evaluate(aStranger))
            .isFalse();
    }

    @Test
    void inConditionHoldsOverASingletonSet() throws Exception {
        ExpressionCode cond = conditionOf("requester.username in friends");
        var theOnlyFriend = requesterAndFriends("david", List.of("david"));

        assertThat(cond.evaluate(theOnlyFriend))
            .isTrue();
    }

    @Test
    void inConditionRejectsAScalarWithATypeError() {
        ExpressionCode cond = conditionOf("requester.username in friends");
        var friendsIsAScalar = requesterAndFriends("david", "david");

        // the type error escapes the built lambda for Semantics to log
        assertThatThrownBy(() -> cond.evaluate(friendsIsAScalar))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("in: friends is a String, not a set");
    }

    @Test
    void ruleWithConditionAndExchangeKeepsBoth() {
        Rule rule = firstRule("""
            (party:(username:"m"),
             rules:(resource:(type:"ln"),
                    condition:(requester.username in friends),
                    exchange:(to:me, resource:(type:"ex"), from:requester)))
            """);
        assertThat(rule.getCondition().toString())
            .isEqualTo("requester.username in friends");
        assertThat(rule.getExchange())
            .isNotNull();
    }

    @Test
    void comparisonConditionEvaluatesAndRenders() throws Exception {
        ExpressionCode cond = conditionOf("2023 < 2024");

        assertThat(cond.toString())
            .isEqualTo("2023 < 2024");
        assertThat(cond.evaluate(NO_NAMES))
            .isTrue();
    }

    @Test
    void anAndConditionEvaluates() throws Exception {
        assertThat(conditionOf("2023 < 2024 and 5 > 1").evaluate(NO_NAMES))
            .isTrue();
    }

    @Test
    void anOrConditionEvaluates() throws Exception {
        assertThat(conditionOf("1 > 2 or 3 > 1").evaluate(NO_NAMES))
            .isTrue();
    }

    @Test
    void aNotConditionEvaluatesAndRenders() throws Exception {
        ExpressionCode cond = conditionOf("not 1 > 2");

        assertThat(cond.toString())
            .isEqualTo("not 1 > 2");
        assertThat(cond.evaluate(NO_NAMES))
            .isTrue();
    }

    @Test
    void partyQualifiedConditionResolvesAndRenders() throws Exception {
        ExpressionCode cond = conditionOf("(department:\"cs\").budget = 100");

        assertThat(cond.toString())
            .isEqualTo("(department:\"cs\").budget = 100");
        assertThat(cond.evaluate(new FakeResolver(Map.of("budget", 100L))))
            .isTrue();
    }
}
