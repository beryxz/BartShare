package com.thesis.bartparser;

import com.thesis.bartparser.BartParser.AndExprContext;
import com.thesis.bartparser.BartParser.CmpExprContext;
import com.thesis.bartparser.BartParser.InExprContext;
import com.thesis.bartparser.BartParser.LitExprContext;
import com.thesis.bartparser.BartParser.NameExprContext;
import com.thesis.bartparser.BartParser.NotExprContext;
import com.thesis.bartparser.BartParser.OrExprContext;
import com.thesis.bartparser.BartParser.ParenExprContext;
import com.thesis.bartparser.BartParser.PartyNameContext;
import com.thesis.bartparser.BartParser.RequesterNameContext;
import com.thesis.bartparser.BartParser.SimpleNameContext;
import com.thesis.bartparser.ast.CmpOp;
import com.thesis.bartparser.ast.Expr;

/** One {@code expr} to an interpretable {@link Expr} tree. */
final class ExprVisitor extends BartBaseVisitor<Expr> {

    private final AtomVisitor atomVisitor = new AtomVisitor();
    private final QNameVisitor qnameVisitor = new QNameVisitor();

    @Override
    public Expr visitParenExpr(ParenExprContext ctx) {
        return visit(ctx.inner);
    }

    @Override
    public Expr visitInExpr(InExprContext ctx) {
        return new Expr.In(visit(ctx.element), qnameVisitor.visit(ctx.set));
    }

    @Override
    public Expr visitCmpExpr(CmpExprContext ctx) {
        return new Expr.Cmp(
            CmpOp.fromSymbol(ctx.op.getText()), visit(ctx.left), visit(ctx.right));
    }

    @Override
    public Expr visitNotExpr(NotExprContext ctx) {
        return new Expr.Not(visit(ctx.inner));
    }

    @Override
    public Expr visitAndExpr(AndExprContext ctx) {
        return new Expr.And(visit(ctx.left), visit(ctx.right));
    }

    @Override
    public Expr visitOrExpr(OrExprContext ctx) {
        return new Expr.Or(visit(ctx.left), visit(ctx.right));
    }

    @Override
    public Expr visitNameExpr(NameExprContext ctx) {
        return qnameVisitor.visit(ctx.qname());
    }

    @Override
    public Expr visitLitExpr(LitExprContext ctx) {
        return new Expr.Lit(atomVisitor.visit(ctx.atom()));
    }

    /** Its own visitor because {@code Expr.In} needs the narrower {@link Expr.Name}. */
    private static final class QNameVisitor extends BartBaseVisitor<Expr.Name> {

        private final AttributeBuilder attributeBuilder = new AttributeBuilder();

        @Override
        public Expr.Name visitSimpleName(SimpleNameContext ctx) {
            return new Expr.SimpleName(ctx.NAME().getText());
        }

        @Override
        public Expr.Name visitRequesterName(RequesterNameContext ctx) {
            return new Expr.RequesterName(ctx.NAME().getText());
        }

        @Override
        public Expr.Name visitPartyName(PartyNameContext ctx) {
            return new Expr.PartyName(
                attributeBuilder.of(ctx.attribute()), ctx.NAME().getText());
        }
    }
}
