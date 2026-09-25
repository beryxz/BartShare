package com.thesis.bartparser;

import java.util.List;

import bart.core.Attributes;

/**
 * Every party one policy refers to. Duplicates are kept in both lists.
 *
 * @param inExchanges  the {@code any}/{@code all} participants of its exchanges, in source
 *                     order, {@code to} before {@code from}
 * @param inConditions the party patterns its rule conditions name, in rule order
 */
public record PolicyParties(
    List<ExchangePartyPattern> inExchanges, List<Attributes> inConditions) {
}
