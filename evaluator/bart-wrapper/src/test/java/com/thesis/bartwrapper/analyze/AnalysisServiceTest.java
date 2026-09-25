package com.thesis.bartwrapper.analyze;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.BartSyntaxInputException;
import com.thesis.bartwrapper.MissingInputException;

class AnalysisServiceTest {

    private static final String NO_RULES = """
        (party:(username:"john"),
         rules:())
        """;
    private static final String WITH_ANY = """
        (party:(username:"mary"),
         rules:(resource:(type:"notes"),
                exchange:(to:me, resource:(type:"exercises"),
                          from:(any:(university:"unifi")))))
        """;

    private final AnalysisService service = new AnalysisService(new PolicyAnalyzer());

    @Test
    void resultsAlignPositionallyWithTheInput() {
        var response = service.analyze(new AnalysisRequest(List.of(NO_RULES, WITH_ANY, NO_RULES)));

        assertThat(response.analyses())
            .hasSize(3);
        assertThat(response.analyses().get(0).quantified())
            .isEmpty();
        assertThat(response.analyses().get(1).quantified())
            .hasSize(1);
        assertThat(response.analyses().get(2).quantified())
            .isEmpty();
        assertThat(response.analyses().get(1).conditionParties())
            .isEmpty();
    }

    @Test
    void anEmptyPolicyListIsRejected() {
        assertThatThrownBy(() -> service.analyze(new AnalysisRequest(List.of())))
            .isInstanceOf(MissingInputException.class);
    }

    @Test
    void aNullPolicyListIsRejected() {
        assertThatThrownBy(() -> service.analyze(new AnalysisRequest(null)))
            .isInstanceOf(MissingInputException.class);
    }

    @Test
    void aBlankPolicyIsRejected() {
        assertThatThrownBy(() -> service.analyze(new AnalysisRequest(List.of(NO_RULES, "  "))))
            .isInstanceOf(MissingInputException.class);
    }

    /** The location is 1-based and names which policy failed, as everywhere else. */
    @Test
    void aSyntaxErrorIsTaggedWithItsPolicyPosition() {
        var truncated = """
            (party:(a:"b")
            """;
        var brokenSecondPolicy = new AnalysisRequest(List.of(NO_RULES, truncated));

        assertThatThrownBy(() -> service.analyze(brokenSecondPolicy))
            .isInstanceOfSatisfying(BartSyntaxInputException.class,
                e -> assertThat(e.getLocation())
                    .isEqualTo("policy 2"));
    }

    /** Parses cleanly, so only building the model rejects it. */
    @Test
    void aDuplicateAttributeKeyIsRejectedEvenThoughItIsNotASyntaxError() {
        var duplicate = """
            (party:(username:"x")(username:"y"),
             rules:())
            """;

        assertThatThrownBy(() -> service.analyze(new AnalysisRequest(List.of(NO_RULES, duplicate))))
            .isInstanceOfSatisfying(BartInputException.class, e -> {
                assertThat(e.getLocation())
                    .isEqualTo("policy 2");
                assertThat(e.getCause())
                    .isInstanceOf(IllegalArgumentException.class);
            });
    }
}
