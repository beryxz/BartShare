package com.thesis.bartparser.value;

/** A NUMBER with a decimal point. */
public record DoubleValue(double value) implements AtomValue {

    @Override
    public String typeName() { return "Double"; }
    @Override
    public Object raw() { return value; }
    @Override
    public int typeRank() { return 1; }

    @SuppressWarnings("unchecked")
    @Override
    public Comparable<Object> payload() {
        return (Comparable<Object>) (Comparable<?>) Double.valueOf(value);
    }
}
