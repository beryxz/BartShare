package com.thesis.bartparser;

import static bart.core.Participants.any;
import static bart.core.Participants.index;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import bart.core.Attributes;
import bart.core.Policies;
import bart.core.Request;

class BartFacadeTest {

    @Test
    void parsesEnrichedRequest() {
        Request r = Bart.parseEnrichedRequest("""
            1 : (resource:(type:"ln"),
                 from:(any:(degreeProgram:"cs")))
            """);
        assertThat(r)
            .isEqualTo(new Request(
                index(1),
                new Attributes().add("type", "ln"),
                any(new Attributes().add("degreeProgram", "cs"))));
    }

    /** Party identity is list position, so order is the assertion that matters. */
    @Test
    void parsesAPolicySystemInPartyOrder() {
        Policies policies = Bart.parsePolicySystem("""
            (party:(username:"john"),
             rules:())
            (party:(username:"mary"),
             rules:())
            """);
        assertThat(policies.getPolicyData())
            .hasSize(2);
        assertThat(policies.getByIndex(1).party())
            .isEqualTo(new Attributes().add("username", "john"));
        assertThat(policies.getByIndex(2).party())
            .isEqualTo(new Attributes().add("username", "mary"));
    }

    /**
     * NUMBER is {@code '-'? [0-9]+ ('.' [0-9]+)?}, the same token that lexes numeric
     * attribute values, so these parse cleanly and fail later, in the model builder, not
     * the parser. They still need a position: an editor integration places its caret from
     * these fields.
     */
    @ParameterizedTest(name = "{0}")
    @MethodSource("indexesThatAreNotInts")
    void rejectsARequestIndexThatIsNotAnIntWithAPosition(String index) {
        String source = index + " : (resource:(type:\"ln\"), from:(any:))";

        assertThatThrownBy(() -> Bart.parseEnrichedRequest(source))
            .as("%s", source)
            .hasMessageContaining("invalid request index: " + index)
            .isInstanceOfSatisfying(BartSyntaxException.class, e -> {
                assertThat(e.getLine())
                    .isEqualTo(1);
                assertThat(e.getColumn())
                    .isEqualTo(0);
            });
    }

    static Stream<String> indexesThatAreNotInts() {
        return Stream.of("3.5", "99999999999");
    }

    /** Parties are 1-based, and NUMBER's leading minus is there for values, not for the index. */
    @ParameterizedTest(name = "{0}")
    @MethodSource("nonPositiveIndexes")
    void rejectsANonPositiveRequestIndexWithAPosition(String index) {
        String source = index + " : (resource:(type:\"ln\"), from:(any:))";

        assertThatThrownBy(() -> Bart.parseEnrichedRequest(source))
            .as("%s", source)
            .hasMessageContaining("invalid request index: " + index)
            .isInstanceOfSatisfying(BartSyntaxException.class, e -> {
                assertThat(e.getLine())
                    .isEqualTo(1);
                assertThat(e.getColumn())
                    .isEqualTo(0);
            });
    }

    static Stream<String> nonPositiveIndexes() {
        return Stream.of("0", "-1");
    }

    /**
     * NUMBER bounds no digit count, so both lex and reach the model build, where neither may
     * become a raw NumberFormatException nor, for the decimal, an infinite value. Single line:
     * a break would move the asserted column.
     */
    @ParameterizedTest(name = "{0}")
    @MethodSource("numbersTooWideForTheirType")
    void rejectsANumberTooWideForItsTypeWithAPosition(String number) {
        String source = "(party:(tags:" + number + "), rules:())";

        assertThatThrownBy(() -> Bart.parsePolicy(source))
            .as("%s", source)
            .isInstanceOfSatisfying(BartSyntaxException.class, e -> {
                assertThat(e.getRawMessage())
                    .isEqualTo("number out of range: " + number);
                assertThat(e.getLine())
                    .isEqualTo(1);
                assertThat(e.getColumn())
                    .isEqualTo(13);
            });
    }

    /** Long.MAX_VALUE + 1, then a decimal past double's range. */
    static Stream<String> numbersTooWideForTheirType() {
        return Stream.of("9223372036854775808", "1" + "0".repeat(400) + ".0");
    }

    /** ValueVisitor and ExprVisitor hold separate AtomVisitors, so a condition needs its own. */
    @Test
    void rejectsANumberTooWideInsideACondition() {
        var source = """
            (party:(username:"john"),
             rules:(resource:(type:"ln"),
                    condition:(level < 9223372036854775808)))
            """;
        assertThatThrownBy(() -> Bart.parsePolicy(source))
            .isInstanceOf(BartSyntaxException.class)
            .hasMessageContaining("number out of range: 9223372036854775808");
    }

    /** Names a party in both an exchange and a condition, so neither list comes back empty. */
    private static final String BOTH_PARTY_KINDS = """
        (party:(username:"owner"),
         rules:(resource:(kind:"doc"),
                condition:((role:"auditor").level < 3),
                exchange:(to:me, resource:(kind:"ack"), from:(any:(dept:"eng")))))
        """;

    @Test
    void policyPartiesReturnsWhatTheSinglePurposeMethodsReturn() {
        var parties = Bart.policyParties(BOTH_PARTY_KINDS);

        assertThat(parties.inExchanges())
            .isEqualTo(Bart.exchangePartyPatterns(BOTH_PARTY_KINDS))
            .isNotEmpty();
        assertThat(parties.inConditions())
            .isEqualTo(Bart.conditionPartyPatterns(BOTH_PARTY_KINDS))
            .isNotEmpty();
    }

    /** Parses cleanly, so only the discarded model build rejects it. */
    @Test
    void policyPartiesRejectsADuplicateAttributeKey() {
        var duplicateUsername = """
            (party:(username:"x")(username:"y"),
             rules:())
            """;

        assertThatThrownBy(() -> Bart.policyParties(duplicateUsername))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void policyPartiesReportsASyntaxErrorWithItsPosition() {
        assertThatThrownBy(() -> Bart.policyParties("(party:(a:\"b\")"))
            .isInstanceOfSatisfying(BartSyntaxException.class,
                e -> assertThat(e.getLine())
                    .isEqualTo(1));
    }

    @Test
    void parsesScenarioIntoThreeParts() {
        var sc = Bart.parseScenario("""
            (party:(username:"john"),
             rules:())
            ((friends:"david"))
            1 : (resource:(type:"ln"),
                 from:(any:(degreeProgram:"cs")))
            """);
        assertThat(sc.policies())
            .isNotNull();
        assertThat(sc.request().requester())
            .isEqualTo(index(1));
        // single-atom context value is a scalar, not a list
        assertThat(sc.context().ofParty(1).name("friends"))
            .isEqualTo("david");
    }
}
