package com.thesis.bartparser;

import bart.core.Participants;
import bart.core.QuantifiedParticipant;
import com.thesis.bartparser.BartParser.OthersContext;

/** Builds the quantified participant shared by an exchange's ends and a request's {@code from}. */
final class ParticipantBuilder {

    private final AttributeBuilder attributeBuilder = new AttributeBuilder();

    QuantifiedParticipant others(OthersContext ctx) {
        var pattern = attributeBuilder.of(ctx.attribute());
        return switch (Quantifier.of(ctx.quant.getText())) {
            case ANY -> Participants.any(pattern);
            case ALL -> Participants.all(pattern);
        };
    }
}
