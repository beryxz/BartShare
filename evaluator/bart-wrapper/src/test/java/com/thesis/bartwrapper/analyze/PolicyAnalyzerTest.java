package com.thesis.bartwrapper.analyze;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.thesis.bartparser.BartSyntaxException;

class PolicyAnalyzerTest {

    private final PolicyAnalyzer analyzer = new PolicyAnalyzer();

    @Test
    void aPolicyWithNoRulesHasNoPatterns() {
        var policy = """
            (party:(username:"john"),
             rules:())
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .isEmpty();
    }

    @Test
    void aRuleWithNoExchangeHasNoPatterns() {
        var policy = """
            (party:(username:"john"),
             rules:(resource:(type:"notes")))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .isEmpty();
    }

    @Test
    void meAndRequesterContributeNothing() {
        var policy = """
            (party:(username:"john"),
             rules:(resource:(type:"notes"),
                    exchange:(to:me, resource:(type:"papers"), from:requester)))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .isEmpty();
    }

    @Test
    void aQuantifiedFromIsReportedWithItsAttributes() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"notes"),
                    exchange:(to:me, resource:(type:"exercises"),
                              from:(any:(studyLevel:"undergraduate")(university:"unifi")))))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .singleElement()
            .satisfies(p -> {
                assertThat(p.role())
                    .isEqualTo(ExchangeRole.FROM);
                assertThat(p.quant())
                    .isEqualTo(Quant.ANY);
                assertThat(p.attrs())
                    .isEqualTo(
                        Map.of("studyLevel", "undergraduate", "university", "unifi"));
            });
    }

    @Test
    void aQuantifiedToIsReportedToo() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"notes"),
                    exchange:(to:(all:(role:"tutor")), resource:(type:"exercises"),
                              from:requester)))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .singleElement()
            .satisfies(p -> {
                assertThat(p.role())
                    .isEqualTo(ExchangeRole.TO);
                assertThat(p.quant())
                    .isEqualTo(Quant.ALL);
                assertThat(p.attrs())
                    .isEqualTo(Map.of("role", "tutor"));
            });
    }

    /** An empty pattern is Bart's wildcard, and must survive as an empty map, not vanish. */
    @Test
    void anEmptyQuantifiedPatternIsReportedAsAnEmptyMap() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"notes"),
                    exchange:(to:me, resource:(type:"exercises"), from:(any:))))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .singleElement()
            .satisfies(p -> {
                assertThat(p.quant())
                    .isEqualTo(Quant.ANY);
                assertThat(p.attrs())
                    .isEmpty();
            });
    }

    /** A short-circuit here would lose a party. */
    @Test
    void bothBranchesOfAnAndAreWalked() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"notes"),
                    exchange:(to:me, resource:(type:"a"), from:(any:(k:"1")))
                               and (to:me, resource:(type:"b"), from:(any:(k:"2")))))
            """;
        var patterns = analyzer.analyze(policy).quantified();

        assertThat(patterns)
            .hasSize(2);
        assertThat(patterns)
            .extracting(p -> p.attrs().get("k"))
            .containsExactlyInAnyOrder("1", "2");
    }

    @Test
    void bothBranchesOfAnOrAreWalked() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"notes"),
                    exchange:(to:me, resource:(type:"a"), from:(any:(k:"1")))
                               or (to:me, resource:(type:"b"), from:(any:(k:"2")))))
            """;
        var patterns = analyzer.analyze(policy).quantified();

        assertThat(patterns)
            .hasSize(2);
        assertThat(patterns)
            .extracting(p -> p.attrs().get("k"))
            .containsExactlyInAnyOrder("1", "2");
    }

    @Test
    void nestedCompositesAreWalkedToTheLeaves() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"notes"),
                    exchange:((to:me, resource:(type:"a"), from:(any:(k:"1")))
                                and (to:me, resource:(type:"b"), from:(any:(k:"2"))))
                               or (to:me, resource:(type:"c"), from:(any:(k:"3")))))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .extracting(p -> p.attrs().get("k"))
            .containsExactlyInAnyOrder("1", "2", "3");
    }

    @Test
    void everyRuleInThePolicyContributes() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"a"),
                    exchange:(to:me, resource:(type:"x"), from:(any:(k:"1"))))
                   (resource:(type:"b"),
                    exchange:(to:me, resource:(type:"y"), from:(any:(k:"2")))))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .hasSize(2);
    }

    @Test
    void aCollectionValueSurvivesAsAList() {
        var policy = """
            (party:(username:"mary"),
             rules:(resource:(type:"notes"),
                    exchange:(to:me, resource:(type:"e"), from:(any:(tags:{"a","b"})))))
            """;

        assertThat(analyzer.analyze(policy).quantified())
            .singleElement()
            .satisfies(
                p -> assertThat(p.attrs().get("tags"))
                    .isEqualTo(List.of("a", "b")));
    }

    @Test
    void aSyntaxErrorPropagates() {
        var truncated = """
            (party:(username:"mary")
            """;

        assertThatThrownBy(() -> analyzer.analyze(truncated))
            .isInstanceOf(BartSyntaxException.class);
    }

    @Test
    void aPartyQualifiedConditionIsReportedAsAConditionParty() {
        var policy = """
            (party:(username:"owner"),
             rules:(resource:(kind:"doc"),
                    condition:((role:"auditor").level < 3)))
            """;
        var analysis = analyzer.analyze(policy);

        assertThat(analysis.quantified())
            .isEmpty();
        assertThat(analysis.conditionParties())
            .containsExactly(new ConditionParty(Map.of("role", "auditor")));
    }

    @Test
    void aPolicyCanReportBothExchangeAndConditionParties() {
        var policy = """
            (party:(username:"owner"),
             rules:(resource:(kind:"doc"),
                    condition:((role:"auditor").level < 3),
                    exchange:(to:me, resource:(kind:"ack"), from:(any:(dept:"eng")))))
            """;
        var analysis = analyzer.analyze(policy);

        assertThat(analysis.quantified())
            .hasSize(1);
        assertThat(analysis.conditionParties())
            .containsExactly(new ConditionParty(Map.of("role", "auditor")));
    }

    @Test
    void aPolicyWithNoConditionsHasNoConditionParties() {
        var policy = """
            (party:(username:"john"),
             rules:())
            """;

        assertThat(analyzer.analyze(policy).conditionParties())
            .isEmpty();
    }
}
