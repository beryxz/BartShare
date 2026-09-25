package com.thesis.bartparser.value;

import java.util.List;

import com.thesis.bartparser.BartTypeException;

/** A set literal or a set-valued attribute. Elements are atoms; the grammar has no nesting. */
public record SetValue(List<AtomValue> elements) implements BartValue {

    @Override
    public String typeName() { return "set"; }
    @Override
    public boolean isAtom() { return false; }
    @Override
    public boolean isSet() { return true; }

    /** The List the engine stores and compares, rebuilt element by element. */
    @Override
    public Object raw() {
        return elements.stream().map(BartValue::raw).toList();
    }

    @Override
    public boolean contains(AtomValue element) {
        return elements.contains(element);
    }

    @Override
    public boolean isTrue() {
        throw new BartTypeException("set is not a condition");
    }

    @Override
    public AtomValue asAtom() {
        throw new BartTypeException("set is not comparable");
    }
}
