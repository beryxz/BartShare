package com.thesis.bartwrapper.engine;

import java.util.List;
import java.util.stream.IntStream;

import bart.core.ContextHandler;
import bart.core.Policies;
import com.thesis.bartparser.Bart;
import com.thesis.bartparser.BartModelBuilder;
import com.thesis.bartparser.Parsers;
import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.ContextArityException;

/**
 * Builds {@code bart.core} model objects from the `.bart` sources supplied with a request.
 * <p>
 * Deliberately model-first: each policy is parsed on its own and added in list order, rather
 * than concatenating everything through {@code parseScenario} (that facade is for the parser's
 * own fixture tests). {@code EngineAssemblerTest} pins the two as equivalent via a differential
 * oracle.
 * </p>
 */
final class EngineAssembler {

    private EngineAssembler() {
    }

    /**
     * Parses each policy independently and adds them in list order. A policy's position in
     * the returned {@link Policies} is its party identity, 1-based.
     *
     * @throws BartInputException tagged {@code "policy N"} for the first source that fails
     */
    static Policies policies(List<String> policySources) {
        var policies = new Policies();
        IntStream.range(0, policySources.size())
            .mapToObj(i -> BartInputException.tagging("policy " + (i + 1),
                () -> Bart.parsePolicy(policySources.get(i))))
            .forEach(policies::add);
        return policies;
    }

    /**
     * Parses the context tuple once, checks it carries exactly one attribute list per party,
     * then builds the model.
     * <p>
     * The count has to come from the parse tree, not the model: {@link ContextHandler} exposes
     * no party count and {@code ofParty} mutates its map on read. So this reaches past the
     * {@code Bart} facade to {@code Parsers} and {@code BartModelBuilder} directly.
     * </p>
     *
     * @param expectedParties the number of policies, which the tuple's length must equal
     * @throws BartInputException  tagged {@code "context"} if the tuple does not parse
     * @throws ContextArityException if it parses but has the wrong number of lists
     */
    static ContextHandler context(String contextTuple, int expectedParties) {
        var parsed = BartInputException.tagging("context",
            () -> Parsers.contextFile(contextTuple).context());

        int actual = parsed.attrList().size();
        if (actual != expectedParties) {
            throw new ContextArityException(actual, expectedParties);
        }

        return BartInputException.tagging("context",
            () -> new BartModelBuilder().buildContext(parsed));
    }
}
