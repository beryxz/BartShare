package com.thesis.bartparser.value;

/** A NUMBER with no decimal point. */
public record LongValue(long value) implements AtomValue {

    @Override
    public String typeName() { return "Long"; }
    @Override
    public Object raw() { return value; }
    @Override
    public int typeRank() { return 2; }

    @SuppressWarnings("unchecked")
    @Override
    public Comparable<Object> payload() {
        return (Comparable<Object>) (Comparable<?>) Long.valueOf(value);
    }
}
