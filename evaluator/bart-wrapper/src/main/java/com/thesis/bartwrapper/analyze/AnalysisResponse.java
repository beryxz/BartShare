package com.thesis.bartwrapper.analyze;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The parties each submitted policy refers to, positionally aligned with the request.
 *
 * @param analyses one entry per submitted policy, in the order submitted. Serialised as
 *                 {@code policies}, mirroring the request's own array
 */
public record AnalysisResponse(@JsonProperty("policies") List<PolicyAnalysis> analyses) {

    /**
     * One policy's findings.
     *
     * @param quantified       its {@code any}/{@code all} exchange participants; empty when
     *                         the policy has no rules, no exchanges, or names only
     *                         {@code me}/{@code requester}
     * @param conditionParties the parties its rule conditions refer to by attribute pattern;
     *                         empty when no condition uses a party-qualified name
     */
    public record PolicyAnalysis(
        List<QuantifiedPattern> quantified,
        List<ConditionParty> conditionParties) {
    }
}
