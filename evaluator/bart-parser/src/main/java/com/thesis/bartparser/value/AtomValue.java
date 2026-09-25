package com.thesis.bartparser.value;

import com.thesis.bartparser.BartTypeException;

/**
 * A scalar value: the grammar's {@code atom}, and the only thing a set can hold. The natural
 * order is total across the whole atom domain, ranked type first, because set literals are
 * canonically sorted so equal multisets build equal Lists. An ordering comparison inside a
 * condition is narrower and gates on {@link #sameTypeAs} first.
 */
public sealed interface AtomValue extends BartValue, Comparable<AtomValue>
    permits StrValue, LongValue, DoubleValue, BoolValue {

    /** Boolean 0, Double 1, Long 2, String 3, the order set canonicalisation has always used. */
    int typeRank();

    /**
     * The payload, mutually comparable only with the payload of an atom of the same rank. Public
     * only because an interface cannot narrow an abstract method and a record cannot extend an
     * abstract class; what keeps it safe is its one call site in {@link #compareTo}, which gates
     * on {@link #sameTypeAs} first.
     *
     * @throws ClassCastException if compared against the payload of another rank
     */
    Comparable<Object> payload();

    /** What an ordering comparison in a condition requires, and canonical order does not. */
    default boolean sameTypeAs(AtomValue other) {
        return typeRank() == other.typeRank();
    }

    @Override
    default int compareTo(AtomValue other) {
        return sameTypeAs(other)
            ? payload().compareTo(other.payload())
            : Integer.compare(typeRank(), other.typeRank());
    }

    @Override
    default boolean isAtom() {
        return true;
    }

    @Override
    default boolean isSet() {
        return false;
    }

    @Override
    default AtomValue asAtom() {
        return this;
    }

    @Override
    default boolean contains(AtomValue element) {
        throw new BartTypeException(typeName() + " is not a set");
    }

    @Override
    default boolean isTrue() {
        throw new BartTypeException(typeName() + " is not a condition");
    }
}
