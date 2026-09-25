package com.thesis.bartparser;

import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;

/** .bart text -> ANTLR parse-tree contexts. */
public final class Parsers {

    private Parsers() {}

    private static BartParser parser(String text) {
        var listener = new ThrowingErrorListener();
        var lexer = new BartLexer(CharStreams.fromString(text));
        lexer.removeErrorListeners();
        lexer.addErrorListener(listener);
        var parser = new BartParser(new CommonTokenStream(lexer));
        parser.removeErrorListeners();
        parser.addErrorListener(listener);
        return parser;
    }

    public static BartParser.PolicyFileContext policyFile(String text) {
        return parser(text).policyFile();
    }

    public static BartParser.PolicySystemFileContext policySystemFile(String text) {
        return parser(text).policySystemFile();
    }

    public static BartParser.ContextFileContext contextFile(String text) {
        return parser(text).contextFile();
    }

    public static BartParser.EnrichedRequestFileContext enrichedRequestFile(String text) {
        return parser(text).enrichedRequestFile();
    }

    public static BartParser.ScenarioFileContext scenarioFile(String text) {
        return parser(text).scenarioFile();
    }
}
