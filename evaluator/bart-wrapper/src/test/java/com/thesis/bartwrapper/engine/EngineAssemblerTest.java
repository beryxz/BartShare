package com.thesis.bartwrapper.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Collections;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import com.thesis.bartparser.Bart;
import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.BartSyntaxInputException;
import com.thesis.bartwrapper.ContextArityException;

class EngineAssemblerTest {

    private static final String JOHN = """
        (party:(username:"john")(university:"unifi"),
         rules:(resource:(type:"lectureNotes")(course:"ads")))
        """;

    private static final String MARY = """
        (party:(username:"mary")(university:"unifi"),
         rules:(resource:(type:"exercises"),
                exchange:(to:me, resource:(type:"lectureNotes"), from:requester)))
        """;

    private static final String DAVID = """
        (party:(username:"david")(university:"unifi"),
         rules:())
        """;

    /** A minimal rule-less party. The grammar requires `party:` to carry an attribute. */
    private static String consumer(String username) {
        return """
            (party:(username:"%s"),
             rules:())
            """.formatted(username);
    }

    /** N parties named p1..pN, each rule-less. */
    private static List<String> parties(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(i -> consumer("p" + i)).toList();
    }

    /** A context tuple of `count` empty attribute lists. */
    private static String emptyTuple(int count) {
        return "(" + String.join(",", Collections.nCopies(count, "()")) + ")";
    }

    // --- the differential oracle: model-first assembly == parsing the whole system ------

    @Test
    void buildingPolicyByPolicyMatchesParsingTheWholeSystem() {
        var modelFirst = EngineAssembler.policies(List.of(JOHN, MARY, DAVID));

        var viaPolicySystem = Bart.parsePolicySystem(JOHN + "\n" + MARY + "\n" + DAVID);

        assertThat(modelFirst.description())
            .isEqualTo(viaPolicySystem.description());
    }

    @Test
    void theEquivalenceHoldsForASinglePolicy() {
        var sources = parties(1);

        assertThat(EngineAssembler.policies(sources).description())
            .isEqualTo(Bart.parsePolicySystem(String.join("\n", sources)).description());
    }

    @Test
    void theEquivalenceHoldsForFiveParties() {
        var sources = parties(5);

        assertThat(EngineAssembler.policies(sources).description())
            .isEqualTo(Bart.parsePolicySystem(String.join("\n", sources)).description());
    }

    @Test
    void preservesPartyOrderAsIdentityForAnyCount() {
        var policies = EngineAssembler.policies(parties(5));

        IntStream.rangeClosed(1, 5)
            .forEach(party -> assertThat(policies.getByIndex(party).party().name("username"))
                .isEqualTo("p" + party));
    }

    // --- error tagging -----------------------------------------------------------------

    @Test
    void aMalformedPolicyIsTaggedWithItsOneBasedPartyPosition() {
        var broken = """
            (party:(username:"broken"), rules:)
            """;
        var sources = List.of(JOHN, broken, DAVID);

        assertThatThrownBy(() -> EngineAssembler.policies(sources))
            .isInstanceOfSatisfying(BartSyntaxInputException.class,
                e -> assertThat(e.getLocation())
                    .isEqualTo("policy 2"));
    }

    @Test
    void aDuplicateAttributeKeyIsTaggedTooEvenThoughItIsNotASyntaxError() {
        var duplicateUsername = """
            (party:(username:"x")(username:"y"),
             rules:())
            """;
        var sources = List.of(duplicateUsername);

        assertThatThrownBy(() -> EngineAssembler.policies(sources))
            .isInstanceOfSatisfying(BartInputException.class, e -> {
                assertThat(e.getLocation())
                    .isEqualTo("policy 1");
                assertThat(e.getCause())
                    .isInstanceOf(IllegalArgumentException.class);
            });
    }

    // --- context ------------------------------------------------------------------------

    @Test
    void anAllEmptyTupleLeavesEveryPartyWithoutAttributes() {
        var context = EngineAssembler.context("((),(),())", 3);

        IntStream.rangeClosed(1, 3)
            .forEach(party -> assertThat(context.ofParty(party).isEmpty())
                .isTrue());
    }

    @Test
    void tupleAttributesLandOnTheMatchingPartyIndex() {
        var tuple = """
            (
              (),
              (friends:"a","b"),
              ()
            )
            """;
        var context = EngineAssembler.context(tuple, 3);

        assertThat(context.ofParty(1).isEmpty())
            .isTrue();
        assertThat(context.ofParty(2).name("friends"))
            .isEqualTo(List.of("a", "b"));
        assertThat(context.ofParty(3).isEmpty())
            .isTrue();
    }

    @Test
    void aContextOfAnySizeIsFineAsLongAsItMatchesThePartyCount() {
        var context = EngineAssembler.context(emptyTuple(7), 7);

        assertThat(context.ofParty(7).isEmpty())
            .isTrue();
    }

    /**
     * A short tuple must not be silently padded: every later party's attributes would shift
     * by one and the evaluation would answer permit/deny wrongly rather than erroring.
     */
    @Test
    void tooFewAttributeListsAreRejected() {
        assertThatThrownBy(() -> EngineAssembler.context("((),())", 3))
            .isInstanceOf(ContextArityException.class)
            .hasMessageContaining("2")
            .hasMessageContaining("3");
    }

    @Test
    void tooManyAttributeListsAreRejected() {
        assertThatThrownBy(() -> EngineAssembler.context("((),(),(),())", 3))
            .isInstanceOf(ContextArityException.class)
            .hasMessageContaining("4")
            .hasMessageContaining("3");
    }

    @Test
    void aMalformedContextIsTaggedAsComingFromTheContext() {
        var unclosed = """
            ((friends:"a"),()
            """;

        assertThatThrownBy(() -> EngineAssembler.context(unclosed, 2))
            .isInstanceOfSatisfying(BartSyntaxInputException.class,
                e -> assertThat(e.getLocation())
                    .isEqualTo("context"));
    }
}
