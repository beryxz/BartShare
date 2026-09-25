package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import bart.core.Attributes;

class ExchangePartyPatternsTest {

    @Test
    void aQuantifiedFromIsReportedWithItsSideAndAttributes() {
        var found = Bart.exchangePartyPatterns("""
            (party:(username:"j"),
             rules:(resource:(type:"a"),
                    exchange:(to:me, resource:(type:"b"), from:(any:(role:"tutor")))))
            """);

        assertThat(found)
            .containsExactly(new ExchangePartyPattern(
                ExchangeSide.FROM, Quantifier.ANY, new Attributes().add("role", "tutor")));
    }

    @Test
    void meAndRequesterContributeNothing() {
        var found = Bart.exchangePartyPatterns("""
            (party:(username:"j"),
             rules:(resource:(type:"a"),
                    exchange:(to:me, resource:(type:"b"), from:requester)))
            """);

        assertThat(found)
            .isEmpty();
    }

    /** Source order, to before from, both branches of a composite. */
    @Test
    void everyBranchContributesInSourceOrder() {
        var found = Bart.exchangePartyPatterns("""
            (party:(username:"j"),
             rules:(resource:(type:"a"),
                    exchange:(to:(all:(k:"1")), resource:(type:"b"), from:(any:(k:"2")))
                               and (to:me, resource:(type:"c"), from:(any:(k:"3")))))
            """);

        assertThat(found)
            .extracting(ExchangePartyPattern::quantifier)
            .containsExactly(Quantifier.ALL, Quantifier.ANY, Quantifier.ANY);
        assertThat(found)
            .extracting(ExchangePartyPattern::side)
            .containsExactly(ExchangeSide.TO, ExchangeSide.FROM, ExchangeSide.FROM);
        assertThat(found)
            .extracting(p -> p.pattern().name("k"))
            .containsExactly("1", "2", "3");
    }

    /** An empty pattern is Bart's wildcard, and must survive rather than vanish. */
    @Test
    void anEmptyPatternIsStillAPattern() {
        var found = Bart.exchangePartyPatterns("""
            (party:(username:"j"),
             rules:(resource:(type:"a"),
                    exchange:(to:me, resource:(type:"b"), from:(any:))))
            """);

        assertThat(found)
            .containsExactly(new ExchangePartyPattern(
                ExchangeSide.FROM, Quantifier.ANY, new Attributes()));
    }
}
