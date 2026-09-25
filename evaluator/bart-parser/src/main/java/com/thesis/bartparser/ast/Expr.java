package com.thesis.bartparser.ast;

import bart.core.Attributes;
import bart.core.NameResolver;
import com.thesis.bartparser.BartTypeException;
import com.thesis.bartparser.value.AtomValue;
import com.thesis.bartparser.value.BartValue;
import com.thesis.bartparser.value.BoolValue;

/** Interpretable AST for a Bart condition, evaluated against a NameResolver. */
public sealed interface Expr
    permits Expr.And, Expr.Or, Expr.Not, Expr.Cmp, Expr.In, Expr.Name, Expr.Lit {

    BartValue eval(NameResolver nr) throws Exception;

    String render();

    /** The rule's answer. A value that is not a boolean is a type error, never a false. */
    default boolean evalCondition(NameResolver nr) throws Exception {
        return eval(nr).isTrue();
    }

    record And(Expr left, Expr right) implements Expr {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            return new BoolValue(left.evalCondition(nr) && right.evalCondition(nr));
        }
        @Override
        public String render() { return left.render() + " and " + right.render(); }
    }

    record Or(Expr left, Expr right) implements Expr {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            return new BoolValue(left.evalCondition(nr) || right.evalCondition(nr));
        }
        @Override
        public String render() { return left.render() + " or " + right.render(); }
    }

    record Not(Expr inner) implements Expr {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            return new BoolValue(!inner.evalCondition(nr));
        }
        @Override
        public String render() { return "not " + inner.render(); }
    }

    record Cmp(CmpOp op, Expr left, Expr right) implements Expr {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            return new BoolValue(op.holds(left.eval(nr), right.eval(nr)));
        }
        @Override
        public String render() {
            return left.render() + " " + op.symbol() + " " + right.render();
        }
    }

    /**
     * {@code in} is membership of an atom in a set, so a non-set right operand and a non-atom
     * left one are both type errors, not a legitimate {@code false}: each denies, and the trace
     * names the offending side and its actual type. Returning false instead would let
     * {@code not (x in y)} negate a type error into a permit.
     */
    record In(Expr element, Name set) implements Expr {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            BartValue values = set.eval(nr);
            if (!values.isSet()) {
                throw new BartTypeException(
                    "in: " + set.render() + " is a " + values.typeName() + ", not a set");
            }
            BartValue member = element.eval(nr);
            if (!member.isAtom()) {
                throw new BartTypeException(
                    "in: " + element.render() + " is a " + member.typeName()
                        + ", not a set element");
            }
            return new BoolValue(values.contains(member.asAtom()));
        }
        @Override
        public String render() { return element.render() + " in " + set.render(); }
    }

    /** A name the resolver looks up, in the grammar's three qualified forms. */
    sealed interface Name extends Expr permits SimpleName, RequesterName, PartyName {}

    record SimpleName(String name) implements Name {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            return BartValue.of(nr.name(name));
        }
        @Override
        public String render() { return name; }
    }

    record RequesterName(String name) implements Name {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            return BartValue.of(nr.nameFromRequester(name));
        }
        @Override
        public String render() { return "requester." + name; }
    }

    record PartyName(Attributes party, String name) implements Name {
        @Override
        public BartValue eval(NameResolver nr) throws Exception {
            return BartValue.of(nr.nameFromParty(name, party));
        }
        @Override
        public String render() { return renderPattern() + "." + name; }

        private String renderPattern() {
            StringBuilder rendered = new StringBuilder();
            party.names()
                .forEach(key -> rendered
                    .append('(')
                    .append(key)
                    .append(':')
                    .append(BartValue.of(party.name(key)).render())
                    .append(')'));
            return rendered.toString();
        }
    }

    record Lit(AtomValue value) implements Expr {
        @Override
        public BartValue eval(NameResolver nr) { return value; }
        @Override
        public String render() { return value.render(); }
    }
}
