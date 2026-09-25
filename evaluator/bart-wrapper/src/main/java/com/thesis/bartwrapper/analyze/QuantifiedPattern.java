package com.thesis.bartwrapper.analyze;

import java.util.Map;

/**
 * One {@code any}/{@code all} participant found inside a policy's exchanges: lets a caller
 * compute the policy-system closure without parsing `.bart` itself, by matching this pattern
 * against whatever party universe it has.
 *
 * @param role  which side of the exchange it appeared on
 * @param quant the quantifier it carried
 * @param attrs the attribute pattern, possibly empty. An <em>empty</em> pattern is Bart's
 *              wildcard and matches every party, not "no pattern here"
 */
public record QuantifiedPattern(ExchangeRole role, Quant quant, Map<String, Object> attrs) {
}
