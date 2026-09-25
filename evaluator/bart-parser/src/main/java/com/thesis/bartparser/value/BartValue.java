package com.thesis.bartparser.value;

import java.util.Collection;

import com.thesis.bartparser.BartTypeException;

/**
 * A value a condition can compute over. An operator that accepts only part of the domain refuses
 * the rest here, so a type error aborts the condition instead of reaching the operator as a
 * silent {@code false} that {@code not} would negate into a permit.
 */
public sealed interface BartValue permits AtomValue, SetValue, NullValue {

    /** The name error messages use, "set" for a collection. */
    String typeName();

    /** The Java value the engine stores and compares. */
    Object raw();

    /** Whether an ordering comparison may narrow this with {@link #asAtom}. */
    boolean isAtom();

    /** Whether {@code in} may ask this for membership. */
    boolean isSet();

    /** This as a truth value; anything but a boolean is a type error. */
    boolean isTrue();

    /** This as an orderable atom; call only when {@link #isAtom} holds. */
    AtomValue asAtom();

    /** Whether this set holds the element; call only when {@link #isSet} holds. */
    boolean contains(AtomValue element);

    /** As the trace shows it, which is as the policy author wrote it. */
    default String render() {
        return String.valueOf(raw());
    }

    /**
     * Types a value handed back by {@code NameResolver}, the one place the engine's untyped
     * {@code Object} crosses into this package. Everything the parser builds is typed at
     * construction instead, and the engine cannot be changed to hand back anything narrower.
     */
    static BartValue of(Object value) {
        return switch (value) {
            case null -> NullValue.NULL;
            case String s -> new StrValue(s);
            case Long l -> new LongValue(l);
            case Double d -> new DoubleValue(d);
            case Boolean b -> new BoolValue(b);
            case Collection<?> c -> new SetValue(
                c.stream().map(BartValue::of).map(BartValue::asAtom).toList());
            default -> throw new BartTypeException(
                "name resolved to an unsupported value type");
        };
    }
}
