package com.thesis.bartparser;

import java.util.List;

import bart.core.Attributes;
import bart.core.ContextHandler;
import bart.core.Policies;
import bart.core.Policy;
import bart.core.Request;

/** Public facade: `.bart` text -> bart.core model. Throws BartSyntaxException on bad input. */
public final class Bart {

    private Bart() {}

    public static Policies parsePolicySystem(String text) {
        return new BartModelBuilder()
            .buildPolicySystem(Parsers.policySystemFile(text).policySystem());
    }

    public static Policy parsePolicy(String text) {
        return new BartModelBuilder()
            .buildPolicy(Parsers.policyFile(text).policy());
    }

    /**
     * The party patterns a policy's rule conditions refer to, via the
     * {@code attribute+ '.' NAME} qname form. A policy-system caller must load these parties
     * too, or {@code nameFromParty} finds no match and the condition denies silently.
     * Duplicates survive; deduplication is the caller's business.
     */
    public static List<Attributes> conditionPartyPatterns(String text) {
        return ConditionPartyPatterns.of(Parsers.policyFile(text).policy());
    }

    /**
     * The {@code any}/{@code all} participants of this policy's exchanges, in source order,
     * {@code to} before {@code from}. Complements {@link #conditionPartyPatterns}: together
     * they are every party a caller must load for the policy to evaluate as written.
     */
    public static List<ExchangePartyPattern> exchangePartyPatterns(String text) {
        return ExchangePartyPatterns.of(Parsers.policyFile(text).policy());
    }

    /**
     * Both party sets of one policy off a single parse: {@link #exchangePartyPatterns} and
     * {@link #conditionPartyPatterns} without reparsing, and the same validation as
     * {@link #parsePolicy}.
     */
    public static PolicyParties policyParties(String text) {
        var policy = Parsers.policyFile(text).policy();
        // model discarded; building it is what rejects a duplicate attribute key
        new BartModelBuilder().buildPolicy(policy);
        return new PolicyParties(
            ExchangePartyPatterns.of(policy), ConditionPartyPatterns.of(policy));
    }

    public static ContextHandler parseContext(String text) {
        return new BartModelBuilder()
            .buildContext(Parsers.contextFile(text).context());
    }

    public static Request parseEnrichedRequest(String text) {
        return new BartModelBuilder()
            .buildEnrichedRequest(Parsers.enrichedRequestFile(text).enrichedRequest());
    }

    public static Scenario parseScenario(String text) {
        var b = new BartModelBuilder();
        var s = Parsers.scenarioFile(text);
        return new Scenario(
            b.buildPolicySystem(s.policySystem()),
            b.buildContext(s.context()),
            b.buildEnrichedRequest(s.enrichedRequest()));
    }
}
