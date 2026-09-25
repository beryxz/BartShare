package com.thesis.bartparser;

import java.util.ArrayList;
import java.util.List;

import bart.core.Attributes;
import com.thesis.bartparser.BartParser.PartyNameContext;
import com.thesis.bartparser.BartParser.PolicyContext;

/**
 * Collects the party patterns a policy's conditions refer to: the
 * {@code qname : attribute+ '.' NAME} form (Bart.g4), resolved at evaluation time by
 * {@code NameResolver.nameFromParty}. Exists because a condition is compiled into an opaque
 * lambda, so only the parse tree still carries the party reference.
 */
final class ConditionPartyPatterns extends BartBaseVisitor<Void> {

    private final AttributeBuilder attributeBuilder = new AttributeBuilder();
    private final List<Attributes> found = new ArrayList<>();

    /** Duplicates are kept; deduplication is the caller's business. */
    static List<Attributes> of(PolicyContext policy) {
        var patterns = new ConditionPartyPatterns();
        patterns.visit(policy);
        return patterns.found;
    }

    /**
     * The only qualified form that names a party; everything else walks through. Cannot
     * over-collect: {@code partyName} occurs only inside {@code expr}, and {@code expr} only
     * under {@code condition:}.
     */
    @Override
    public Void visitPartyName(PartyNameContext ctx) {
        found.add(attributeBuilder.of(ctx.attribute()));
        return null;
    }
}
