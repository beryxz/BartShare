package com.thesis.bartparser.ast;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import bart.core.Attributes;
import bart.core.semantics.UndefinedName;
import com.thesis.bartparser.BartTypeException;
import com.thesis.bartparser.FakeResolver;
import com.thesis.bartparser.value.BoolValue;
import com.thesis.bartparser.value.DoubleValue;
import com.thesis.bartparser.value.LongValue;
import com.thesis.bartparser.value.StrValue;

class ExprTest {

    private static final FakeResolver NO_NAMES = new FakeResolver(Map.of());
    private static final Expr YES = new Expr.Cmp(CmpOp.EQ, lit(1L), lit(1L));
    private static final Expr NO = new Expr.Cmp(CmpOp.EQ, lit(1L), lit(2L));

    /**
     * Resolves nothing, so evaluating it throws instead of answering: reaching it fails the test
     * that placed it. Staying unreached is what keeps an ill-typed operand behind a short
     * circuit silent.
     */
    private static final Expr NEVER = new Expr.SimpleName("undefined");

    private static Expr membership() {
        return new Expr.In(
            new Expr.RequesterName("username"), new Expr.SimpleName("friends"));
    }

    @Test
    void inMembershipTrueAndRenders() throws Exception {
        Expr e = membership();
        var nr = new FakeResolver(Map.of(
            "requester.username", "david",
            "friends", List.of("ashley", "david")));
        assertThat(e.evalCondition(nr))
            .isTrue();
        assertThat(e.render())
            .isEqualTo("requester.username in friends");
    }

    @Test
    void inMembershipFalse() throws Exception {
        Expr e = membership();
        var nr = new FakeResolver(Map.of(
            "requester.username", "mary",
            "friends", List.of("ashley", "david")));
        assertThat(e.evalCondition(nr))
            .isFalse();
    }

    @Test
    void inOverAScalarThrowsALegibleTypeError() {
        Expr e = membership();
        var nr = new FakeResolver(Map.of(
            "requester.username", "david",
            "friends", "david"));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("in: friends is a String, not a set");
    }

    @Test
    void inOverANumberNamesTheActualType() {
        Expr e = new Expr.In(
            new Expr.RequesterName("username"), new Expr.RequesterName("friends"));
        var nr = new FakeResolver(Map.of(
            "requester.username", "david",
            "requester.friends", 42L));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("in: requester.friends is a Long, not a set");
    }

    /** A set is not a legal set element, so List.contains must never get to answer false here. */
    @Test
    void aSetOnTheLeftOfMembershipNamesTheOffendingSide() {
        Expr e = new Expr.In(new Expr.SimpleName("friends"), new Expr.SimpleName("allow"));
        var nr = new FakeResolver(Map.of(
            "friends", List.of("x", "y"),
            "allow", List.of("x")));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("in: friends is a set, not a set element");
    }

    @Test
    void inOverASingletonCollectionIsTrue() throws Exception {
        var nr = new FakeResolver(Map.of(
            "requester.username", "david",
            "friends", List.of("david")));
        assertThat(membership().evalCondition(nr))
            .isTrue();
    }

    @Test
    void inOverAnEmptyCollectionIsFalse() throws Exception {
        var nr = new FakeResolver(Map.of(
            "requester.username", "david",
            "friends", List.of()));
        assertThat(membership().evalCondition(nr))
            .isFalse();
    }

    /**
     * Unreachable in production, since NameResolverImplementation filters nulls before this
     * runs, but the message-building code must not NPE if it ever is. {@code Map.of()} rejects
     * nulls, so the fake's map is built directly.
     */
    @Test
    void inOverANullIsANullSafeTypeErrorNotAnNpe() {
        Expr e = membership();
        var values = new HashMap<String, Object>();
        values.put("requester.username", "david");
        values.put("friends", null);
        var nr = new FakeResolver(values);
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("in: friends is a null, not a set");
    }

    @Test
    void inOverAnUndefinedNameStillThrowsUndefinedName() {
        Expr e = membership();
        var nr = new FakeResolver(Map.of("requester.username", "david"));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(UndefinedName.class);
    }

    @Test
    void comparingASetIsALegibleTypeErrorNotACastException() {
        Expr e = new Expr.Cmp(CmpOp.LT,
            new Expr.SimpleName("friends"), new Expr.Lit(new StrValue("x")));
        var nr = new FakeResolver(Map.of("friends", List.of("a", "b")));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("<: cannot compare set with String");
    }

    @Test
    void notWrappingAFailedComparisonStillThrowsInsteadOfPermitting() {
        Expr e = new Expr.Not(new Expr.Cmp(CmpOp.LT,
            new Expr.SimpleName("friends"), new Expr.Lit(new StrValue("x"))));
        var nr = new FakeResolver(Map.of("friends", List.of("a", "b")));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("<: cannot compare set with String");
    }

    /**
     * The whole reason In and Cmp throw instead of returning false: a non-boolean operand that
     * degrades to false lets {@code not} negate it into a permit, so a malformed policy grants
     * access.
     */
    @Test
    void aNonBooleanOperandOfNotIsATypeErrorNotAPermit() {
        Expr e = new Expr.Not(new Expr.SimpleName("owner"));
        var nr = new FakeResolver(Map.of("owner", "alice"));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("String is not a condition");
    }

    /** Nesting must not launder the type error into a false the outer 'not' flips to a permit. */
    @Test
    void aNestedNotOverANonBooleanIsStillATypeError() {
        Expr e = new Expr.Not(new Expr.Not(new Expr.SimpleName("owner")));
        var nr = new FakeResolver(Map.of("owner", "alice"));
        assertThatThrownBy(() -> e.eval(nr))
            .isInstanceOf(BartTypeException.class)
            .hasMessage("String is not a condition");
    }

    @Test
    void aNonBooleanOperandOfAndOrIsAlsoATypeError() {
        var nr = new FakeResolver(Map.of("owner", "alice"));
        Expr owner = new Expr.SimpleName("owner");
        Expr and = new Expr.And(owner, new Expr.Lit(new BoolValue(true)));
        Expr or = new Expr.Or(owner, new Expr.Lit(new BoolValue(false)));

        assertThatThrownBy(() -> and.eval(nr))
            .isInstanceOf(BartTypeException.class);
        assertThatThrownBy(() -> or.eval(nr))
            .isInstanceOf(BartTypeException.class);
    }

    @Test
    void comparingAcrossNumericTypesIsAlsoALegibleTypeError() {
        Expr e = new Expr.Cmp(CmpOp.GT,
            new Expr.Lit(new LongValue(10L)), new Expr.Lit(new DoubleValue(3.5)));
        assertThatThrownBy(() -> e.eval(new FakeResolver(Map.of())))
            .isInstanceOf(BartTypeException.class)
            .hasMessage(">: cannot compare Long with Double");
    }

    @Test
    void equalityBetweenSetsIsUnaffectedByTheComparabilityCheck() throws Exception {
        // '=' must not route through ordering: sets are equatable but not comparable
        Expr e = new Expr.Cmp(CmpOp.EQ, new Expr.SimpleName("a"), new Expr.SimpleName("b"));
        var nr = new FakeResolver(Map.of("a", List.of("x", "y"), "b", List.of("x", "y")));
        assertThat(e.evalCondition(nr))
            .isTrue();
    }

    /**
     * Every operator against a smaller, an equal and a larger right operand. The equal rows are
     * the point: they are what separates {@code <} from {@code <=}.
     */
    @ParameterizedTest(name = "{1} {0} {2} is {3}")
    @CsvSource({
        "EQ,   3,  3,  true", "EQ,   3, 10, false",
        "NEQ,  3, 10,  true", "NEQ,  3,  3, false",
        "LT,   3, 10,  true", "LT,   3,  3, false", "LT,  10,  3, false",
        "GT,  10,  3,  true", "GT,   3,  3, false", "GT,   3, 10, false",
        "LTE,  3,  3,  true", "LTE,  3, 10,  true", "LTE, 10,  3, false",
        "GTE,  3,  3,  true", "GTE, 10,  3,  true", "GTE,  3, 10, false",
    })
    void everyOperatorAnswersAcrossTheOrderingBoundary(
        CmpOp op, long left, long right, boolean expected) throws Exception {
        var comparison = new Expr.Cmp(op, lit(left), lit(right));

        assertThat(comparison.evalCondition(NO_NAMES))
            .isEqualTo(expected);
    }

    @Test
    void equalityAndInequalityAlsoAnswerOverStrings() throws Exception {
        var nr = new FakeResolver(Map.of());
        assertThat(new Expr.Cmp(CmpOp.EQ, lit("a"), lit("a")).evalCondition(nr))
            .isTrue();
        assertThat(new Expr.Cmp(CmpOp.NEQ, lit("a"), lit("b")).evalCondition(nr))
            .isTrue();
    }

    @Test
    void andIsFalseWhenItsRightIsFalse() throws Exception {
        assertThat(new Expr.And(YES, NO).evalCondition(NO_NAMES))
            .isFalse();
    }

    @Test
    void notNegatesItsOperand() throws Exception {
        assertThat(new Expr.Not(NO).evalCondition(NO_NAMES))
            .isTrue();
    }

    /** evalCondition unwraps to a bare boolean, where eval keeps the BoolValue the AST works in. */
    @Test
    void evalYieldsABoolValueWhereEvalConditionUnwrapsIt() throws Exception {
        assertThat(new Expr.Not(NO).eval(NO_NAMES))
            .isEqualTo(new BoolValue(true));
    }

    @Test
    void aLiteralRendersItsValue() {
        assertThat(lit("2024").render())
            .isEqualTo("\"2024\"");
        assertThat(lit(2024L).render())
            .isEqualTo("2024");
    }

    @Test
    void andStopsAtAFalseLeft() throws Exception {
        assertThat(new Expr.And(NO, NEVER).evalCondition(NO_NAMES))
            .isFalse();
    }

    @Test
    void orStopsAtATrueLeft() throws Exception {
        assertThat(new Expr.Or(YES, NEVER).evalCondition(NO_NAMES))
            .isTrue();
    }

    /** Both outcomes, so a right operand that answers false is pinned as well as a true one. */
    @Test
    void orAnswersWithItsRightWhenTheLeftIsFalse() throws Exception {
        assertThat(new Expr.Or(NO, YES).evalCondition(NO_NAMES))
            .isTrue();
        assertThat(new Expr.Or(NO, NO).evalCondition(NO_NAMES))
            .isFalse();
    }

    @Test
    void compositesRenderBothOperands() {
        Expr left = new Expr.Cmp(CmpOp.LT, lit(1L), lit(2L));
        Expr right = new Expr.Cmp(CmpOp.GTE, lit(3L), lit(3L));
        assertThat(new Expr.And(left, right).render())
            .isEqualTo("1 < 2 and 3 >= 3");
        assertThat(new Expr.Or(left, right).render())
            .isEqualTo("1 < 2 or 3 >= 3");
    }

    /** Unreachable while the enum covers the grammar, so it reports our bug, not the author's. */
    @Test
    void anOperatorSymbolTheEnumLacksIsAnIllegalState() {
        assertThatThrownBy(() -> CmpOp.fromSymbol("=~"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("unknown operator =~");
    }

    @Test
    void partyQualifiedNameRenders() {
        Expr e = new Expr.PartyName(
            new Attributes().add("department", "cs").add("faculty", "eng"), "budget");
        assertThat(e.render())
            .isEqualTo("(department:\"cs\")(faculty:\"eng\").budget");
    }

    private static Expr.Lit lit(String value) {
        return new Expr.Lit(new StrValue(value));
    }

    private static Expr.Lit lit(long value) {
        return new Expr.Lit(new LongValue(value));
    }
}
