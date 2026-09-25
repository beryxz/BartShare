package com.thesis.bartparser.ast;

import java.util.Arrays;

import com.thesis.bartparser.BartTypeException;
import com.thesis.bartparser.value.BartValue;

/** The grammar's comparison operators. Equality accepts the whole domain, ordering does not. */
public enum CmpOp {

    EQ("=") {
        @Override
        boolean holds(BartValue left, BartValue right) {
            return left.equals(right);
        }
    },
    NEQ("!=") {
        @Override
        boolean holds(BartValue left, BartValue right) {
            return !left.equals(right);
        }
    },
    LT("<") {
        @Override
        boolean holds(BartValue left, BartValue right) {
            return ordered(left, right) < 0;
        }
    },
    GT(">") {
        @Override
        boolean holds(BartValue left, BartValue right) {
            return ordered(left, right) > 0;
        }
    },
    LTE("<=") {
        @Override
        boolean holds(BartValue left, BartValue right) {
            return ordered(left, right) <= 0;
        }
    },
    GTE(">=") {
        @Override
        boolean holds(BartValue left, BartValue right) {
            return ordered(left, right) >= 0;
        }
    };

    private final String symbol;

    CmpOp(String symbol) {
        this.symbol = symbol;
    }

    /** @throws IllegalStateException if the grammar ever admits a symbol this enum lacks */
    public static CmpOp fromSymbol(String symbol) {
        return Arrays.stream(values())
            .filter(op -> op.symbol.equals(symbol))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("unknown operator " + symbol));
    }

    String symbol() {
        return symbol;
    }

    /** Whether the comparison holds; each constant answers for itself. */
    abstract boolean holds(BartValue left, BartValue right);

    /**
     * Ordering is defined only between two atoms of the same type. A set operand or a Long/Double
     * mix is a type error, not a false: the expression then has no value, which is what keeps
     * {@code not (friends < "x")} denying instead of permitting.
     */
    final int ordered(BartValue left, BartValue right) {
        if (!left.isAtom() || !right.isAtom() || !left.asAtom().sameTypeAs(right.asAtom())) {
            throw new BartTypeException(
                symbol + ": cannot compare " + left.typeName() + " with " + right.typeName());
        }
        return left.asAtom().compareTo(right.asAtom());
    }
}
