package com.thesis.bartparser;

import java.util.ArrayList;
import java.util.List;

import com.thesis.bartparser.BartParser.FromOthersContext;
import com.thesis.bartparser.BartParser.OthersContext;
import com.thesis.bartparser.BartParser.PolicyContext;
import com.thesis.bartparser.BartParser.ToOthersContext;

/**
 * Collects the quantified participants of a policy's exchanges, in source order, {@code to}
 * before {@code from}.
 * <p>
 * Read from the parse tree rather than the built model: here {@code me} and {@code requester}
 * are separate grammar alternatives and no participant has to be type-tested. Every
 * {@code and}/{@code or} branch is walked, not just the one the engine would take, since a party
 * missing from the policy system degrades into a silent deny.
 * </p>
 */
final class ExchangePartyPatterns extends BartBaseVisitor<Void> {

    private final AttributeBuilder attributeBuilder = new AttributeBuilder();
    private final List<ExchangePartyPattern> found = new ArrayList<>();

    /**
     * Duplicates are kept; deduplication is the caller's business. Cannot over-collect the
     * request's {@code others}, which is unlabelled and so never reaches {@code visitFromOthers};
     * entry at a policy keeps it out of the subtree anyway.
     */
    static List<ExchangePartyPattern> of(PolicyContext policy) {
        var patterns = new ExchangePartyPatterns();
        patterns.visit(policy);
        return patterns.found;
    }

    @Override
    public Void visitToOthers(ToOthersContext ctx) {
        add(ExchangeSide.TO, ctx.others());
        return null;
    }

    @Override
    public Void visitFromOthers(FromOthersContext ctx) {
        add(ExchangeSide.FROM, ctx.others());
        return null;
    }

    private void add(ExchangeSide side, OthersContext ctx) {
        found.add(new ExchangePartyPattern(
            side,
            Quantifier.of(ctx.quant.getText()),
            attributeBuilder.of(ctx.attribute())));
    }
}
