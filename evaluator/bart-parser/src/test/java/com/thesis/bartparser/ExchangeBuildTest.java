package com.thesis.bartparser;

import static com.thesis.bartparser.TestPolicies.firstRule;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import bart.core.AndExchange;
import bart.core.Attributes;
import bart.core.Exchange;
import bart.core.OrExchange;
import bart.core.Participants;
import bart.core.SingleExchange;

/**
 * Model building the grammar admits but the differential-oracle scenarios never exercise: an
 * {@code exchange} block into the {@code bart.core} exchange tree, an empty {@code rules:()}
 * block, and an unrecognized {@code Quantifier} token.
 */
class ExchangeBuildTest {

    private static final String A = "(to:me, resource:(type:\"a\"), from:requester)";
    private static final String B = "(to:me, resource:(type:\"b\"), from:requester)";
    private static final String C = "(to:me, resource:(type:\"c\"), from:requester)";

    private static final String POLICY = """
        (party:(username:"j"),
         rules:(resource:(type:"x"),
                exchange:%s))
        """;

    private static Exchange exchangeOf(String exchange) {
        return firstRule(POLICY.formatted(exchange)).getExchange();
    }

    /**
     * Deviation 1 in Bart.g4: {@code and} binds tighter than {@code or}, and parentheses always
     * override. Asserting both shapes is what proves the grouping is read rather than discarded.
     */
    @Test
    void parenthesesOverrideTheDefaultPrecedence() {
        assertThat(exchangeOf(A + " or " + B + " and " + C))
            .isInstanceOfSatisfying(OrExchange.class,
                or -> assertThat(or.right())
                    .isInstanceOf(AndExchange.class));

        assertThat(exchangeOf("((" + A + " or " + B + ") and " + C + ")"))
            .isInstanceOfSatisfying(AndExchange.class,
                and -> assertThat(and.left())
                    .isInstanceOf(OrExchange.class));
    }

    @Test
    void aQuantifiedToParticipantKeepsItsQuantifier() {
        Attributes tutor = new Attributes().add("role", "tutor");

        assertThat(exchangeOf("(to:(any:(role:\"tutor\")), resource:(type:\"a\"), from:requester)"))
            .isInstanceOfSatisfying(SingleExchange.class,
                single -> assertThat(single.to())
                    .isEqualTo(Participants.any(tutor)));

        assertThat(exchangeOf("(to:(all:(role:\"tutor\")), resource:(type:\"a\"), from:requester)"))
            .isInstanceOfSatisfying(SingleExchange.class,
                single -> assertThat(single.to())
                    .isEqualTo(Participants.all(tutor)));
    }

    /** bart-wrapper tells authors to write this for a party that only makes requests. */
    @Test
    void emptyRulesBuildAnEmptyRuleSetRatherThanNull() {
        var source = """
            (party:(username:"j"),
             rules:())
            """;
        var rules = Bart.parsePolicy(source).rules();

        assertThat(rules)
            .isNotNull();
        assertThat(rules.getRuleData())
            .isEmpty();
    }

    /**
     * Unreachable while the grammar admits only these two, so it reports our bug, not the
     * author's.
     */
    @Test
    void aQuantifierTokenTheEnumLacksIsAnIllegalState() {
        assertThatThrownBy(() -> Quantifier.of("some"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("unknown quantifier: some");
    }
}
