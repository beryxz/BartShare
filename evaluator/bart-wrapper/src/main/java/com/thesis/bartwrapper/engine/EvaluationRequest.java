package com.thesis.bartwrapper.engine;

import java.util.List;

/**
 * Everything an evaluation needs. Nothing is held server-side: a caller sends every party's
 * policy, the context, and the request on every call.
 *
 * @param policies one `.bart` policy per party. Position is party identity: the first entry
 *                 is party 1. A party that only ever makes requests still needs an entry;
 *                 give it an empty rule set, {@code (party:(username:"x"), rules:())}.
 * @param context  the `.bart` context tuple, one attribute list per party in the same order,
 *                 e.g. {@code ((),(friends:{"a"}),())}
 * @param request  the `.bart` enriched request, e.g.
 *                 {@code 2: (resource:(type:"notes"), from:(any:))}
 */
public record EvaluationRequest(List<String> policies, String context, String request) {
}
