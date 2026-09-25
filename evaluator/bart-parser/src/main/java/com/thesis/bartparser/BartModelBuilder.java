package com.thesis.bartparser;

import java.util.List;
import java.util.stream.IntStream;

import org.antlr.v4.runtime.Token;

import bart.core.ContextHandler;
import bart.core.Participants;
import bart.core.Policies;
import bart.core.Policy;
import bart.core.Request;
import com.thesis.bartparser.BartParser.AttrListContext;
import com.thesis.bartparser.BartParser.AttributeContext;
import com.thesis.bartparser.BartParser.ContextContext;
import com.thesis.bartparser.BartParser.EmptyAttrListContext;
import com.thesis.bartparser.BartParser.EnrichedRequestContext;
import com.thesis.bartparser.BartParser.NonEmptyAttrListContext;
import com.thesis.bartparser.BartParser.PolicyContext;
import com.thesis.bartparser.BartParser.PolicySystemContext;
import com.thesis.bartparser.BartParser.RequestContext;

/** Builds bart.core model objects from the grammar rules that carry no alternatives. */
public class BartModelBuilder {

    private final AttributeBuilder attributeBuilder = new AttributeBuilder();
    private final RulesVisitor rulesVisitor = new RulesVisitor();
    private final AttrListVisitor attrListVisitor = new AttrListVisitor();
    private final ParticipantBuilder participantBuilder = new ParticipantBuilder();
    /** The context adds attributes one at a time, so it needs values without an Attributes. */
    private final ValueVisitor valueVisitor = new ValueVisitor();

    Policies buildPolicySystem(PolicySystemContext ctx) {
        Policies policies = new Policies();
        ctx.policy().forEach(policy -> policies.add(buildPolicy(policy)));
        return policies;
    }

    Policy buildPolicy(PolicyContext ctx) {
        return new Policy(attributeBuilder.of(ctx.attribute()), rulesVisitor.visit(ctx.rules()));
    }

    Request buildEnrichedRequest(EnrichedRequestContext ctx) {
        RequestContext request = ctx.request();
        return new Request(
            Participants.index(requesterIndex(ctx)),
            attributeBuilder.of(request.attribute()),
            participantBuilder.others(request.others()));
    }

    /**
     * Public because the wrapper counts the tuple's attribute lists on the parse tree before
     * building: {@code ContextHandler} exposes no party count.
     */
    public ContextHandler buildContext(ContextContext ctx) {
        ContextHandler handler = new ContextHandler();
        List<AttrListContext> lists = ctx.attrList();
        IntStream.range(0, lists.size()).forEach(i -> {
            int party = i + 1;
            attrListVisitor.visit(lists.get(i))
                .forEach(
                    at -> handler.add(party, at.NAME().getText(), valueVisitor.visit(at.value())));
        });
        return handler;
    }

    /**
     * NUMBER also lexes decimals, arbitrarily long digit strings and a leading minus, because the
     * same token carries numeric attribute values, so {@code 3.5 : ...}, an over-int index and a
     * non-positive one all parse cleanly and only fail here. Parties are 1-based, and index 0 is
     * the engine's "unresolved", so anything below 1 names no party.
     */
    private int requesterIndex(EnrichedRequestContext ctx) {
        int index;
        try {
            index = Integer.parseInt(ctx.NUMBER().getText());
        } catch (NumberFormatException e) {
            throw invalidIndex(ctx);
        }
        if (index < 1) {
            throw invalidIndex(ctx);
        }
        return index;
    }

    private static BartSyntaxException invalidIndex(EnrichedRequestContext ctx) {
        Token token = ctx.NUMBER().getSymbol();
        return new BartSyntaxException(token.getLine(), token.getCharPositionInLine(),
            "invalid request index: " + ctx.NUMBER().getText());
    }

    /** Returns the attribute contexts of one party's list, empty for {@code ()}. */
    private static final class AttrListVisitor extends BartBaseVisitor<List<AttributeContext>> {

        @Override
        public List<AttributeContext> visitEmptyAttrList(EmptyAttrListContext ctx) {
            return List.of();
        }

        @Override
        public List<AttributeContext> visitNonEmptyAttrList(NonEmptyAttrListContext ctx) {
            return ctx.attribute();
        }
    }
}
