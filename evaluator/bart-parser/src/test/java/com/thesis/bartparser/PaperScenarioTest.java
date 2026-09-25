package com.thesis.bartparser;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.function.BiFunction;

import org.junit.jupiter.api.Test;

import bart.core.Policies;
import bart.core.Request;
import bart.core.Result;
import bart.core.semantics.Semantics;
import com.thesis.bartparser.examples.CouriersExample;
import com.thesis.bartparser.examples.StudentsExample;

class PaperScenarioTest {

    private static String resource(String name) throws Exception {
        try (var in = PaperScenarioTest.class.getResourceAsStream("/scenarios/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private void assertMatchesOracle(String fixture,
        BiFunction<Semantics, Policies, Request> oracle) throws Exception {
        Policies oraclePolicies = new Policies();
        Semantics oracleSemantics = new Semantics(oraclePolicies);
        Request oracleRequest = oracle.apply(oracleSemantics, oraclePolicies);
        Result expected = oracleSemantics.evaluate(oracleRequest);

        Scenario sc = Bart.parseScenario(resource(fixture));
        Result actual = new Semantics(sc.policies())
            .contextHandler(sc.context())
            .evaluate(sc.request());

        assertThat(actual.isPermitted())
            .isEqualTo(expected.isPermitted());
        assertThat(actual.getRequests())
            .containsExactlyInAnyOrderElementsOf(expected.getRequests());
    }

    @Test
    void ex1MatchesOracle() throws Exception {
        assertMatchesOracle("ex1_basic.bart", StudentsExample::ex1_basic);
    }

    @Test
    void ex2MatchesOracle() throws Exception {
        assertMatchesOracle("ex2_basic_plus_cycle.bart", StudentsExample::ex2_basic_plus_cycle);
    }

    @Test
    void ex3MatchesOracle() throws Exception {
        assertMatchesOracle("ex3_multi_party_exchange.bart",
            StudentsExample::ex3_multi_party_exchange);
    }

    @Test
    void courierEx3MatchesOracle() throws Exception {
        assertMatchesOracle("courier_ex3.bart", CouriersExample::courier_ex3);
    }
}
