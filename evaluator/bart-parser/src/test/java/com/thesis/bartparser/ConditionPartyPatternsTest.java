package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import bart.core.Attributes;

class ConditionPartyPatternsTest {

    /** `Attributes` keeps its map private; names() + name(k) rebuilds it for assertions. */
    private static Map<String, Object> map(Attributes attributes) {
        var m = new LinkedHashMap<String, Object>();
        for (String name : attributes.names()) {
            m.put(name, attributes.name(name));
        }
        return m;
    }

    private static List<Map<String, Object>> patternsOf(String policy) {
        return Bart.conditionPartyPatterns(policy)
            .stream()
            .map(ConditionPartyPatternsTest::map)
            .toList();
    }

    private static String policy(String rules) {
        return """
            (party:(username:"owner"),
             rules:%s)
            """.formatted(rules);
    }

    @Test
    void aPolicyWithNoRulesHasNoPatterns() {
        assertThat(patternsOf(policy("()")))
            .isEmpty();
    }

    @Test
    void aRuleWithNoConditionHasNoPatterns() {
        var rules = """
            (resource:(kind:"doc"))
            """;

        assertThat(patternsOf(policy(rules)))
            .isEmpty();
    }

    @Test
    void anUnqualifiedNameIsNotAPartyReference() {
        var rules = """
            (resource:(kind:"doc"),
             condition:(level < 3))
            """;

        assertThat(patternsOf(policy(rules)))
            .isEmpty();
    }

    @Test
    void aRequesterQualifiedNameIsNotAPartyReference() {
        var rules = """
            (resource:(kind:"doc"),
             condition:(requester.level < 3))
            """;

        assertThat(patternsOf(policy(rules)))
            .isEmpty();
    }

    @Test
    void aPartyQualifiedNameIsReportedWithItsAttributes() {
        var rules = """
            (resource:(kind:"doc"),
             condition:((role:"auditor").level < 3))
            """;

        assertThat(patternsOf(policy(rules)))
            .containsExactly(Map.of("role", "auditor"));
    }

    @Test
    void aMultiAttributePatternKeepsEveryAttribute() {
        var rules = """
            (resource:(kind:"doc"),
             condition:((role:"auditor")(dept:"eng").level < 3))
            """;

        assertThat(patternsOf(policy(rules)))
            .containsExactly(new LinkedHashMap<>(Map.of("role", "auditor", "dept", "eng")));
    }

    /**
     * The set side of {@code in} is a bare {@code qname}, not an {@code expr}, so it is the one
     * party pattern a walk descending only through {@code expr} alternatives never reaches.
     */
    @Test
    void aPartyQualifiedSetOnTheRightOfInIsReported() {
        var rules = """
            (resource:(kind:"doc"),
             condition:(requester.username in (role:"admin").allowlist))
            """;

        assertThat(patternsOf(policy(rules)))
            .containsExactly(Map.of("role", "admin"));
    }

    @Test
    void nestedAndOrNotAreAllWalked() {
        var rules = """
            (resource:(kind:"doc"),
             condition:((a:"1").x = 1 and (not ((b:"2").y = 2 or (c:"3").z = 3))))
            """;

        assertThat(patternsOf(policy(rules)))
            .containsExactly(
                Map.of("a", "1"),
                Map.of("b", "2"),
                Map.of("c", "3"));
    }

    @Test
    void bothSidesOfAComparisonAreWalked() {
        var rules = """
            (resource:(kind:"doc"),
             condition:((a:"1").x = (b:"2").y))
            """;

        assertThat(patternsOf(policy(rules)))
            .containsExactly(Map.of("a", "1"), Map.of("b", "2"));
    }

    @Test
    void patternsFromEveryRuleAreReturnedInRuleOrder() {
        var rules = """
            (resource:(kind:"doc"),
             condition:((a:"1").x = 1))
            (resource:(kind:"photo"),
             condition:((b:"2").y = 2))
            """;

        assertThat(patternsOf(policy(rules)))
            .containsExactly(Map.of("a", "1"), Map.of("b", "2"));
    }
}
