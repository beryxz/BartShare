package com.thesis.bartparser;

import bart.core.AndExchange;
import bart.core.Exchange;
import bart.core.ExchangeFromParticipant;
import bart.core.ExchangeToParticipant;
import bart.core.OrExchange;
import bart.core.Participants;
import bart.core.SingleExchange;
import com.thesis.bartparser.BartParser.AndExchangeContext;
import com.thesis.bartparser.BartParser.FromOthersContext;
import com.thesis.bartparser.BartParser.FromRequesterContext;
import com.thesis.bartparser.BartParser.OrExchangeContext;
import com.thesis.bartparser.BartParser.ParenExchangeContext;
import com.thesis.bartparser.BartParser.SingleExchangeContext;
import com.thesis.bartparser.BartParser.ToMeContext;
import com.thesis.bartparser.BartParser.ToOthersContext;

/** One {@code exchange} to a {@code bart.core} exchange tree. */
final class ExchangeVisitor extends BartBaseVisitor<Exchange> {

    private final AttributeBuilder attributeBuilder = new AttributeBuilder();
    private final ToVisitor toVisitor = new ToVisitor();
    private final FromVisitor fromVisitor = new FromVisitor();

    @Override
    public Exchange visitParenExchange(ParenExchangeContext ctx) {
        return visit(ctx.inner);
    }

    @Override
    public Exchange visitAndExchange(AndExchangeContext ctx) {
        return new AndExchange(visit(ctx.left), visit(ctx.right));
    }

    @Override
    public Exchange visitOrExchange(OrExchangeContext ctx) {
        return new OrExchange(visit(ctx.left), visit(ctx.right));
    }

    @Override
    public Exchange visitSingleExchange(SingleExchangeContext ctx) {
        return new SingleExchange(
            toVisitor.visit(ctx.to()),
            attributeBuilder.of(ctx.attribute()),
            fromVisitor.visit(ctx.from()));
    }

    private static final class ToVisitor extends BartBaseVisitor<ExchangeToParticipant> {

        private final ParticipantBuilder participantBuilder = new ParticipantBuilder();

        @Override
        public ExchangeToParticipant visitToMe(ToMeContext ctx) {
            return Participants.me();
        }

        @Override
        public ExchangeToParticipant visitToOthers(ToOthersContext ctx) {
            return participantBuilder.others(ctx.others());
        }
    }

    private static final class FromVisitor extends BartBaseVisitor<ExchangeFromParticipant> {

        private final ParticipantBuilder participantBuilder = new ParticipantBuilder();

        @Override
        public ExchangeFromParticipant visitFromRequester(FromRequesterContext ctx) {
            return Participants.requester();
        }

        @Override
        public ExchangeFromParticipant visitFromOthers(FromOthersContext ctx) {
            return participantBuilder.others(ctx.others());
        }
    }
}
