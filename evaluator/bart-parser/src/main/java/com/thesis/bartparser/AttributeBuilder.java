package com.thesis.bartparser;

import java.util.List;

import bart.core.Attributes;
import com.thesis.bartparser.BartParser.AttributeContext;

/** Builds one {@link Attributes} from a run of {@code attribute} contexts. */
final class AttributeBuilder {

    private final ValueVisitor valueVisitor = new ValueVisitor();

    Attributes of(List<AttributeContext> attributes) {
        Attributes built = new Attributes();
        attributes.forEach(at -> built.add(at.NAME().getText(), valueVisitor.visit(at.value())));
        return built;
    }
}
