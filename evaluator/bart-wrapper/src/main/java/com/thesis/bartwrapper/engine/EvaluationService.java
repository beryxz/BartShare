package com.thesis.bartwrapper.engine;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import bart.core.semantics.Semantics;
import com.thesis.bartparser.Bart;
import com.thesis.bartwrapper.AttributeMaps;
import com.thesis.bartwrapper.BartInputException;
import com.thesis.bartwrapper.InvalidRequesterException;
import com.thesis.bartwrapper.MissingInputException;
import com.thesis.bartwrapper.PolicyInputs;

/**
 * Evaluates a request against the policies and context supplied with it.
 * <p>
 * Stateless by design: everything the engine needs arrives in the body, so two concurrent
 * callers evaluating different party sets share nothing.
 * </p>
 */
@Service
public class EvaluationService {

    /**
     * Checks, assembles, evaluates. The checks run in a fixed order (policies, context,
     * arity, request, requester bound) so that a given bad body always produces the same
     * error rather than whichever one happened to be found first.
     */
    public EvaluationResponse evaluate(EvaluationRequest input) {
        List<String> policySources = PolicyInputs.require(input.policies());
        String contextTuple = requireText(input.context(), "missing-context", "context");
        String requestText = requireText(input.request(), "missing-request", "request");

        var policies = EngineAssembler.policies(policySources);
        var context = EngineAssembler.context(contextTuple, policySources.size());
        var request = BartInputException.tagging("request",
            () -> Bart.parseEnrichedRequest(requestText));

        // The parser bounds this below, but only the caller knows the party count; the engine
        // swallows an over-range index as a denial, so a typo would read as "denied".
        int requester = request.requester().getIndex();
        if (requester > policySources.size()) {
            throw new InvalidRequesterException(requester, policySources.size());
        }

        // Fresh per call, never beans: Semantics mutates its trace, and
        // ContextHandler.ofParty mutates its backing map on read.
        var semantics = new Semantics(policies).contextHandler(context);
        var result = semantics.evaluate(request);

        var satisfied = result.getRequests()
            .stream()
            .map(each -> new EvaluationResponse.SatisfiedRequest(
                each.requester().getIndex(),
                each.from().getIndex(),
                AttributeMaps.of(each.resource())))
            .toList();

        return new EvaluationResponse(
            result.isPermitted(),
            satisfied,
            semantics.getTrace().toString(),
            scenarioText(policySources, contextTuple, requestText));
    }

    private static String requireText(String value, String slug, String field) {
        if (value == null || value.isBlank()) {
            throw new MissingInputException(slug, field + " is required and must not be blank");
        }
        return value;
    }

    /**
     * The exact text handed to the parser, concatenated in `.bart` scenario order. Since
     * {@code scenarioFile : policySystem context enrichedRequest EOF}, the result is itself a
     * valid `.bart` scenario file, pasteable into the parser's {@code grun} harness to reproduce
     * a surprising decision.
     */
    private static String scenarioText(
        List<String> policySources, String contextTuple, String requestText) {
        return Stream.concat(policySources.stream(), Stream.of(contextTuple, requestText))
            .collect(Collectors.joining("\n", "", "\n"));
    }
}
