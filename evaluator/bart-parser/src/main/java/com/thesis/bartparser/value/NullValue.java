package com.thesis.bartparser.value;

import com.thesis.bartparser.BartTypeException;

/**
 * A name that resolved to nothing. Unreachable in production, since the engine's resolver filters
 * nulls, but every operator must name the type instead of throwing NullPointerException.
 */
public enum NullValue implements BartValue {

    /** The single absent-value case; every operator rejects it by name. */
    NULL;

    @Override
    public String typeName() { return "null"; }
    @Override
    public Object raw() { return null; }
    @Override
    public boolean isAtom() { return false; }
    @Override
    public boolean isSet() { return false; }
    @Override
    public boolean isTrue() { throw new BartTypeException("null is not a condition"); }
    @Override
    public AtomValue asAtom() { throw new BartTypeException("null is not comparable"); }

    @Override
    public boolean contains(AtomValue element) {
        throw new BartTypeException("null is not a set");
    }
}
