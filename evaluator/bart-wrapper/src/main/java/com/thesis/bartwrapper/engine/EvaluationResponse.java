package com.thesis.bartwrapper.engine;

import java.util.List;
import java.util.Map;

/**
 * The result of an evaluation.
 *
 * @param permitted whether access is granted
 * @param requests  the satisfied exchange chain
 * @param trace     the engine's step-by-step log; the primary debugging tool, since a
 *                  buggy condition is indistinguishable from a legitimate denial without it
 * @param scenario  the exact text handed to the parser, concatenated in `.bart` scenario order
 */
public record EvaluationResponse(
    boolean permitted,
    List<SatisfiedRequest> requests,
    String trace,
    String scenario) {

    /**
     * One satisfied request in the exchange chain. Party references are resolved 1-based
     * indexes by the time evaluation returns.
     */
    public record SatisfiedRequest(int requester, int from, Map<String, Object> resource) {
    }
}
