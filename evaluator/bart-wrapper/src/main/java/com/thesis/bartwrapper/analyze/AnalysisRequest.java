package com.thesis.bartwrapper.analyze;

import java.util.List;

/**
 * The policies to analyse. Position is party identity, exactly as in
 * {@code EvaluationRequest}: the caller gets its answers back in the same order it asked.
 *
 * @param policies one `.bart` policy per party, non-empty, none blank
 */
public record AnalysisRequest(List<String> policies) {
}
