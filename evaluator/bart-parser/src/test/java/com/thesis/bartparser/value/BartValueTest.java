package com.thesis.bartparser.value;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

import com.thesis.bartparser.BartTypeException;

class BartValueTest {

    @Test
    void everyCaseNamesItselfTheWayErrorMessagesAlreadyDo() {
        assertThat(new StrValue("a").typeName())
            .isEqualTo("String");
        assertThat(new LongValue(1L).typeName())
            .isEqualTo("Long");
        assertThat(new DoubleValue(1.5).typeName())
            .isEqualTo("Double");
        assertThat(new BoolValue(true).typeName())
            .isEqualTo("Boolean");
        assertThat(new SetValue(List.of()).typeName())
            .isEqualTo("set");
        assertThat(BartValue.of(null).typeName())
            .isEqualTo("null");
    }

    /** Rendering feeds the engine's trace, so a string keeps its quotes and a set its brackets. */
    @Test
    void eachCaseRendersAsThePolicyAuthorWroteIt() {
        assertThat(new StrValue("2024").render())
            .isEqualTo("\"2024\"");
        assertThat(new LongValue(2024L).render())
            .isEqualTo("2024");
        // pins formatting; 1.5 is exact in binary
        assertThat(new DoubleValue(1.5).render())
            .isEqualTo("1.5");
        assertThat(new BoolValue(true).render())
            .isEqualTo("true");
        assertThat(BartValue.of(null).render())
            .isEqualTo("null");
        assertThat(new SetValue(List.of()).render())
            .isEqualTo("[]");
        assertThat(new SetValue(List.of(new StrValue("a"), new StrValue("b"))).render())
            .isEqualTo("[a, b]");
    }

    @Test
    void onlyAtomsAreAtomsAndOnlySetsAreSets() {
        assertThat(new StrValue("a").isAtom())
            .isTrue();
        assertThat(new StrValue("a").isSet())
            .isFalse();
        assertThat(new SetValue(List.of()).isAtom())
            .isFalse();
        assertThat(new SetValue(List.of()).isSet())
            .isTrue();
        assertThat(BartValue.of(null).isAtom())
            .isFalse();
        assertThat(BartValue.of(null).isSet())
            .isFalse();
    }

    @Test
    void onlyABooleanIsATruthValue() {
        assertThat(new BoolValue(true).isTrue())
            .isTrue();
        assertThatThrownBy(() -> new StrValue("a").isTrue())
            .isInstanceOf(BartTypeException.class);
        assertThatThrownBy(() -> new SetValue(List.of()).isTrue())
            .isInstanceOf(BartTypeException.class);
    }

    @Test
    void aSetIsNotAnAtomAndAnAtomIsNotASet() {
        assertThatThrownBy(() -> new SetValue(List.of()).asAtom())
            .isInstanceOf(BartTypeException.class);
        assertThatThrownBy(() -> new StrValue("a").contains(new StrValue("a")))
            .isInstanceOf(BartTypeException.class);
    }

    /** Unreachable in production, since the engine's resolver filters nulls; still must not NPE. */
    @Test
    void everyOperatorRefusesTheNullCaseByName() {
        assertThatThrownBy(() -> BartValue.of(null).isTrue())
            .isInstanceOf(BartTypeException.class)
            .hasMessage("null is not a condition");
        assertThatThrownBy(() -> BartValue.of(null).asAtom())
            .isInstanceOf(BartTypeException.class)
            .hasMessage("null is not comparable");
        assertThatThrownBy(() -> BartValue.of(null).contains(new StrValue("a")))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("null is not a set");
    }

    @Test
    void membershipComparesElementsByValue() {
        var set = new SetValue(List.of(new StrValue("a"), new StrValue("b")));
        assertThat(set.contains(new StrValue("b")))
            .isTrue();
        assertThat(set.contains(new StrValue("c")))
            .isFalse();
    }

    /** Pins the canonical order the set-literal tests depend on: Boolean, Double, Long, String. */
    @Test
    void atomsSortByTypeThenNaturally() {
        List<AtomValue> sorted = Stream.<AtomValue>of(
            new StrValue("a"), new LongValue(10L), new LongValue(9L),
            new BoolValue(true), new DoubleValue(1.5))
            .sorted()
            .toList();
        assertThat(sorted)
            .containsExactly(
                new BoolValue(true), new DoubleValue(1.5),
                new LongValue(9L), new LongValue(10L), new StrValue("a"));
    }

    /** Two atoms of one rank compare by payload, the branch a single-boolean sort never takes. */
    @Test
    void twoBooleansOrderFalseBeforeTrue() {
        List<AtomValue> sorted = Stream.<AtomValue>of(new BoolValue(true), new BoolValue(false))
            .sorted()
            .toList();
        assertThat(sorted)
            .containsExactly(new BoolValue(false), new BoolValue(true));
    }

    @Test
    void sameTypeAsIsWhatOrderingComparisonsGateOn() {
        assertThat(new LongValue(1L).sameTypeAs(new LongValue(2L)))
            .isTrue();
        assertThat(new LongValue(1L).sameTypeAs(new DoubleValue(2.0)))
            .isFalse();
    }

    @Test
    void theEngineBoundaryClassifiesRawObjects() {
        assertThat(BartValue.of("a"))
            .isEqualTo(new StrValue("a"));
        assertThat(BartValue.of(1L))
            .isEqualTo(new LongValue(1L));
        assertThat(BartValue.of(1.5))
            .isEqualTo(new DoubleValue(1.5));
        assertThat(BartValue.of(true))
            .isEqualTo(new BoolValue(true));
        assertThat(BartValue.of(List.of("a")))
            .isEqualTo(new SetValue(List.of(new StrValue("a"))));
        assertThat(BartValue.of(null).typeName())
            .isEqualTo("null");
    }

    /** The engine hands back a bare Object, so an unmodelled type must be named, not ignored. */
    @Test
    void anUnsupportedRawTypeIsRejected() {
        assertThatThrownBy(() -> BartValue.of(new Object()))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("name resolved to an unsupported value type");
    }

    @Test
    void rawUnwrapsBackToWhatTheEngineStores() {
        assertThat(new StrValue("a").raw())
            .isEqualTo("a");
        assertThat(new SetValue(List.of(new LongValue(1L))).raw())
            .isEqualTo(List.of(1L));
    }
}
