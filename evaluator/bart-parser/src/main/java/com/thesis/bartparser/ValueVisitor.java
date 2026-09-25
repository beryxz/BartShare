package com.thesis.bartparser;

import java.util.List;

import com.thesis.bartparser.BartParser.AtomContext;
import com.thesis.bartparser.BartParser.BareListValueContext;
import com.thesis.bartparser.BartParser.ScalarValueContext;
import com.thesis.bartparser.BartParser.SetValueContext;
import com.thesis.bartparser.value.BartValue;

/** One {@code value} to its Java value: an atom stays scalar, both list forms build a List. */
final class ValueVisitor extends BartBaseVisitor<Object> {

    private final AtomVisitor atomVisitor = new AtomVisitor();

    @Override
    public Object visitScalarValue(ScalarValueContext ctx) {
        return atomVisitor.visit(ctx.atom()).raw();
    }

    @Override
    public Object visitBareListValue(BareListValueContext ctx) {
        return collection(ctx.atom());
    }

    @Override
    public Object visitSetValue(SetValueContext ctx) {
        return collection(ctx.atom());
    }

    /**
     * Both list forms build the same immutable List, so the two spellings compare equal, and
     * elements are canonically ordered so equal multisets build equal Lists. Duplicates
     * survive: these are bags, not sets.
     */
    private List<Object> collection(List<AtomContext> elements) {
        return elements.stream().map(atomVisitor::visit).sorted().map(BartValue::raw).toList();
    }
}
