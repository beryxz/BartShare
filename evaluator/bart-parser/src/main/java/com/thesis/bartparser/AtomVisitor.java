package com.thesis.bartparser;

import java.util.regex.Pattern;

import org.antlr.v4.runtime.Token;

import com.thesis.bartparser.BartParser.BoolAtomContext;
import com.thesis.bartparser.BartParser.NumberAtomContext;
import com.thesis.bartparser.BartParser.StringAtomContext;
import com.thesis.bartparser.value.AtomValue;
import com.thesis.bartparser.value.BoolValue;
import com.thesis.bartparser.value.DoubleValue;
import com.thesis.bartparser.value.LongValue;
import com.thesis.bartparser.value.StrValue;

/** One {@code atom} to its typed value. NUMBER carries both integers and decimals. */
final class AtomVisitor extends BartBaseVisitor<AtomValue> {

    @Override
    public AtomValue visitStringAtom(StringAtomContext ctx) {
        return new StrValue(unquote(ctx.STRING().getText()));
    }

    @Override
    public AtomValue visitNumberAtom(NumberAtomContext ctx) {
        String text = ctx.NUMBER().getText();
        // separate returns, not a ternary: mixed Double/Long branches promote to double
        if (text.contains(".")) {
            double value = Double.parseDouble(text);
            if (!Double.isFinite(value)) {
                throw outOfRange(ctx, text);
            }
            return new DoubleValue(value);
        }
        try {
            return new LongValue(Long.parseLong(text));
        } catch (NumberFormatException e) {
            throw outOfRange(ctx, text);
        }
    }

    /**
     * NUMBER bounds no digit count, so a literal too wide for its type lexes cleanly and only
     * fails here: a raw {@code NumberFormatException} would escape the fail-fast contract, and an
     * infinite double would answer conditions with a value the source never wrote.
     */
    private static BartSyntaxException outOfRange(NumberAtomContext ctx, String text) {
        Token token = ctx.NUMBER().getSymbol();
        return new BartSyntaxException(token.getLine(), token.getCharPositionInLine(),
            "number out of range: " + text);
    }

    @Override
    public AtomValue visitBoolAtom(BoolAtomContext ctx) {
        return new BoolValue(Boolean.parseBoolean(ctx.BOOL().getText()));
    }

    /** DOTALL because the STRING rule's {@code '\\' .} escape admits a newline. */
    private static final Pattern ESCAPE = Pattern.compile("\\\\(.)", Pattern.DOTALL);

    /** Strips the quotes, then unescapes: a backslash takes the next character literally. */
    private static String unquote(String raw) {
        return ESCAPE.matcher(raw.substring(1, raw.length() - 1)).replaceAll("$1");
    }
}
