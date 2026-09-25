package com.thesis.bartwrapper.analyze;

import org.springframework.stereotype.Service;

import com.thesis.bartparser.Bart;
import com.thesis.bartparser.ExchangeSide;
import com.thesis.bartparser.Quantifier;
import com.thesis.bartwrapper.AttributeMaps;

/**
 * Reports the parties a policy can reach.
 * <p>
 * Both halves come off the parse tree: an exchange participant is {@code me}, {@code requester}
 * or a quantifier there, and a condition is otherwise compiled into an opaque
 * {@code ExpressionCode} lambda that loses the party reference. Every {@code and}/{@code or}
 * branch counts, not just the one the engine would take, since a party missing from the policy
 * system degrades into a silent deny rather than an error.
 * </p>
 */
@Service
public class PolicyAnalyzer {

    /**
     * @param policySource one `.bart` policy
     * @return its quantified exchange participants (source order, to before from) and the
     *         parties its conditions refer to (rule order)
     * @throws com.thesis.bartparser.BartSyntaxException if the source does not parse
     * @throws IllegalArgumentException if it parses but the model rejects it, as a duplicate
     *         attribute key does
     */
    public AnalysisResponse.PolicyAnalysis analyze(String policySource) {
        var parties = Bart.policyParties(policySource);

        var quantified = parties.inExchanges()
            .stream()
            .map(pattern -> new QuantifiedPattern(
                role(pattern.side()),
                quant(pattern.quantifier()),
                AttributeMaps.of(pattern.pattern())))
            .toList();

        var conditionParties = parties.inConditions()
            .stream()
            .map(attributes -> new ConditionParty(AttributeMaps.of(attributes)))
            .toList();

        return new AnalysisResponse.PolicyAnalysis(quantified, conditionParties);
    }

    /** The parser's grammar-level enums carry no wire spelling; these two do. */
    private static ExchangeRole role(ExchangeSide side) {
        return switch (side) {
            case TO -> ExchangeRole.TO;
            case FROM -> ExchangeRole.FROM;
        };
    }

    private static Quant quant(Quantifier quantifier) {
        return switch (quantifier) {
            case ANY -> Quant.ANY;
            case ALL -> Quant.ALL;
        };
    }
}
