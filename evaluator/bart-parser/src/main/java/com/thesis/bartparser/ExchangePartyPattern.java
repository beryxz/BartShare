package com.thesis.bartparser;

import bart.core.Attributes;

/**
 * One {@code any}/{@code all} participant of an exchange, read off the parse tree.
 *
 * @param side       which side of the exchange it appeared on
 * @param quantifier {@code any} or {@code all}
 * @param pattern    the attribute pattern. An <em>empty</em> pattern is Bart's wildcard and
 *                   matches every party
 */
public record ExchangePartyPattern(
    ExchangeSide side, Quantifier quantifier, Attributes pattern) {
}
