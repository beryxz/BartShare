package com.thesis.bartwrapper.analyze;

import java.util.Map;

/**
 * One party referenced by a rule's <em>condition</em>, via the {@code attribute+ '.' NAME}
 * qname form. Reported separately from {@link QuantifiedPattern}: a condition resolves by
 * first match in policy order, not {@code any}/{@code all}, but the caller still must load
 * every party matching this pattern.
 *
 * @param attrs the attribute pattern. An <em>empty</em> pattern is Bart's wildcard and
 *              matches every party
 */
public record ConditionParty(Map<String, Object> attrs) {
}
