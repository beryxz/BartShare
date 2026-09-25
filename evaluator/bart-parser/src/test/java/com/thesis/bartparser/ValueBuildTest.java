package com.thesis.bartparser;

import static bart.core.Participants.any;
import static bart.core.Participants.index;
import static bart.core.Participants.me;
import static bart.core.Participants.requester;
import static com.thesis.bartparser.TestPolicies.firstRule;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import bart.core.Attributes;
import bart.core.OrExchange;
import bart.core.Policy;
import bart.core.Request;
import bart.core.Rule;
import bart.core.SingleExchange;

class ValueBuildTest {

    private static final String POLICY = """
        (party:(tags:%s),
         rules:())
        """;

    /** Parses a single-attribute party so a value's model form can be asserted directly. */
    private static Attributes attrsOf(String value) {
        return Bart.parsePolicy(POLICY.formatted(value)).party();
    }

    @Test
    void buildsPartyAttributesWithScalarValues() {
        var source = """
            (party:(username:"john")(enrollment:"2024"),
             rules:())
            """;
        Policy p = Bart.parsePolicy(source);

        assertThat(p.party())
            .isEqualTo(
                new Attributes().add("username", "john").add("enrollment", "2024"));
    }

    @Test
    void multiAtomValueBecomesList() {
        var source = """
            (party:(username:"m"),
             rules:(resource:(tags:"a","b")))
            """;
        Rule rule = firstRule(source);

        assertThat(rule.getResource())
            .isEqualTo(new Attributes().add("tags", List.of("a", "b")));
    }

    @Test
    void singleBareAtomStaysAScalar() {
        assertThat(attrsOf("\"a\"").name("tags"))
            .isEqualTo("a");
    }

    @Test
    void escapesInsideAStringAreUnescaped() {
        assertThat(attrsOf("\"a\\\"b\"").name("tags"))
            .isEqualTo("a\"b");
        assertThat(attrsOf("\"a\\\\b\"").name("tags"))
            .isEqualTo("a\\b");
    }

    /** '$' is a group reference in a regex replacement, so an unescaped one must stay literal. */
    @Test
    void aDollarInThePayloadSurvivesUnescaping() {
        assertThat(attrsOf("\"a$b\"").name("tags"))
            .isEqualTo("a$b");
        assertThat(attrsOf("\"a\\$b\"").name("tags"))
            .isEqualTo("a$b");
    }

    /** Pins DOTALL: without it the escape pattern's '.' skips a newline and keeps the backslash. */
    @Test
    void anEscapedNewlineIsUnescapedToARealNewline() {
        assertThat(attrsOf("\"a\\\nb\"").name("tags"))
            .isEqualTo("a\nb");
    }

    @Test
    void braceSetWithTwoAtomsEqualsTheBareCommaForm() {
        assertThat(attrsOf("{\"a\",\"b\"}"))
            .isEqualTo(attrsOf("\"a\",\"b\""));
        assertThat(attrsOf("{\"a\",\"b\"}").name("tags"))
            .isEqualTo(List.of("a", "b"));
    }

    @Test
    void braceSetWithOneAtomIsASingletonCollection() {
        assertThat(attrsOf("{\"a\"}").name("tags"))
            .isEqualTo(List.of("a"));
    }

    @Test
    void emptyBraceSetIsAnEmptyCollection() {
        assertThat(attrsOf("{}").name("tags"))
            .isEqualTo(List.of());
    }

    @Test
    void braceSetKeepsMixedAtomTypesAndDuplicates() {
        assertThat(attrsOf("{1,\"a\",true}").name("tags"))
            .isEqualTo(List.of(true, 1L, "a"));
        assertThat(attrsOf("{\"a\",\"a\"}").name("tags"))
            .isEqualTo(List.of("a", "a"));
    }

    @Test
    void elementOrderIsCanonicalisedSoReorderedSetsAreEqual() {
        assertThat(attrsOf("{\"b\",\"a\"}"))
            .isEqualTo(attrsOf("{\"a\",\"b\"}"));
        assertThat(attrsOf("{\"b\",\"a\"}").name("tags"))
            .isEqualTo(List.of("a", "b"));
    }

    @Test
    void theBareCommaFormIsCanonicalisedTheSameWay() {
        assertThat(attrsOf("\"b\",\"a\""))
            .isEqualTo(attrsOf("{\"a\",\"b\"}"));
    }

    @Test
    void canonicalisationKeepsDuplicatesSoSetsAreBags() {
        assertThat(attrsOf("{\"a\",\"a\"}").name("tags"))
            .isEqualTo(List.of("a", "a"));
        assertThat(attrsOf("{\"a\",\"a\"}"))
            .isNotEqualTo(attrsOf("{\"a\"}"));
    }

    @Test
    void mixedTypesCanonicaliseIdenticallyWhateverTheInputOrder() {
        // grouped by typeRank first (Boolean, Double, Long, String), making the order
        // total across mixed types
        assertThat(attrsOf("{true,\"a\",1}"))
            .isEqualTo(attrsOf("{1,\"a\",true}"));
        // natural order within a type, not lexicographic: 9 sorts before 10
        assertThat(attrsOf("{10,9}").name("tags"))
            .isEqualTo(List.of(9L, 10L));
    }

    @Test
    void buildsSingleExchange() {
        Rule rule = firstRule("""
            (party:(username:"mary"),
             rules:(resource:(type:"ln"),
                    exchange:(to:me, resource:(type:"ex"), from:requester)))
            """);
        assertThat(rule.getExchange())
            .isEqualTo(new SingleExchange(
                me(), new Attributes().add("type", "ex"), requester()));
    }

    @Test
    void buildsOrExchangeTree() {
        Rule rule = firstRule("""
            (party:(username:"mary"),
             rules:(resource:(type:"ln"),
                    exchange:(to:me, resource:(type:"ex"), from:requester)
                               or (to:me, resource:(type:"ln"), from:requester)))
            """);
        assertThat(rule.getExchange())
            .isEqualTo(new OrExchange(
                new SingleExchange(me(), new Attributes().add("type", "ex"), requester()),
                new SingleExchange(me(), new Attributes().add("type", "ln"), requester())));
    }

    @Test
    void buildsEnrichedRequestWithAnyAndIndex() {
        Request r = Bart.parseEnrichedRequest("""
            1 : (resource:(type:"ln")(course:"ads"),
                 from:(any:(degreeProgram:"cs")))
            """);
        assertThat(r)
            .isEqualTo(new Request(
                index(1),
                new Attributes().add("type", "ln").add("course", "ads"),
                any(new Attributes().add("degreeProgram", "cs"))));
    }

    @Test
    void buildsContextHandlerWithListValue() {
        var context = """
            (
              (friends:"ashley","david"),
              ()
            )
            """;
        var ch = Bart.parseContext(context);

        // ofParty(i) returns a DynamicAttributes subclass, and Attributes.equals is
        // getClass()-strict, so assert on the read value rather than the container.
        assertThat(ch.ofParty(1).name("friends"))
            .isEqualTo(List.of("ashley", "david"));
    }
}
