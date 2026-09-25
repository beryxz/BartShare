package com.thesis.bartparser.value;

/** The one case a condition may stand on by itself. */
public record BoolValue(boolean value) implements AtomValue {

    @Override
    public String typeName() { return "Boolean"; }
    @Override
    public Object raw() { return value; }
    @Override
    public int typeRank() { return 0; }
    @Override
    public boolean isTrue() { return value; }

    @SuppressWarnings("unchecked")
    @Override
    public Comparable<Object> payload() {
        return (Comparable<Object>) (Comparable<?>) Boolean.valueOf(value);
    }
}
