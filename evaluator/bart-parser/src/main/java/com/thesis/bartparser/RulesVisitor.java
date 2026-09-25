package com.thesis.bartparser;

import bart.core.Attributes;
import bart.core.ExpressionCode;
import bart.core.ExpressionWithDescription;
import bart.core.Rule;
import bart.core.Rules;
import com.thesis.bartparser.BartParser.EmptyRulesContext;
import com.thesis.bartparser.BartParser.ExchangeContext;
import com.thesis.bartparser.BartParser.ExprContext;
import com.thesis.bartparser.BartParser.NonEmptyRulesContext;
import com.thesis.bartparser.BartParser.PolicyRuleContext;
import com.thesis.bartparser.ast.Expr;

/** One {@code rules} block to {@code bart.core} rules, in source order. */
final class RulesVisitor extends BartBaseVisitor<Rules> {

    private final AttributeBuilder attributeBuilder = new AttributeBuilder();
    private final ExprVisitor exprVisitor = new ExprVisitor();
    private final ExchangeVisitor exchangeVisitor = new ExchangeVisitor();

    @Override
    public Rules visitEmptyRules(EmptyRulesContext ctx) {
        return new Rules();
    }

    @Override
    public Rules visitNonEmptyRules(NonEmptyRulesContext ctx) {
        Rules rules = new Rules();
        ctx.policyRule().forEach(rule -> rules.add(rule(rule)));
        return rules;
    }

    private Rule rule(PolicyRuleContext ctx) {
        Attributes resource = attributeBuilder.of(ctx.attribute());
        ExprContext condition = ctx.expr();
        ExchangeContext exchange = ctx.exchange();
        if (condition == null && exchange == null) {
            return new Rule(resource);
        }
        if (exchange == null) {
            return new Rule(resource, condition(condition));
        }
        if (condition == null) {
            return new Rule(resource, exchangeVisitor.visit(exchange));
        }
        return new Rule(resource, condition(condition), exchangeVisitor.visit(exchange));
    }

    /** Wrapped with its rendered source so the engine's trace stays readable. */
    private ExpressionCode condition(ExprContext ctx) {
        Expr expr = exprVisitor.visit(ctx);
        return new ExpressionWithDescription(expr::evalCondition, expr.render());
    }
}
