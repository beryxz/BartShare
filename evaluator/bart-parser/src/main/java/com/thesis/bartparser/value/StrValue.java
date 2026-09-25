package com.thesis.bartparser.value;

/** A quoted string. */
public record StrValue(String value) implements AtomValue {

    @Override
    public String typeName() { return "String"; }
    @Override
    public Object raw() { return value; }
    @Override
    public String render() { return "\"" + value + "\""; }
    @Override
    public int typeRank() { return 3; }

    @SuppressWarnings("unchecked")
    @Override
    public Comparable<Object> payload() {
        return (Comparable<Object>) (Comparable<?>) value;
    }
}
