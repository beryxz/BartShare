import { AccessEvaluation, AccessResult, AccessVerdict } from '@/lib/api/types';
import {
    flattenTrace,
    isErrored,
    parseTrace,
    traceVerdict,
} from '@/lib/bart/trace';

/**
 * The message of the first swallowed condition exception in the trace.
 *
 * The engine catches an exception thrown inside a condition, logs it, and
 * denies the rule, so recovering the cause means reading the trace. The type is
 * discarded before the string leaves the engine, so the message comes back
 * whole. Best-effort by contract: a trace with no errored line degrades to a
 * plain deny, and this must never be able to fail a response.
 */
export function exceptionMessage(trace: string): string | undefined {
    for (const node of flattenTrace(parseTrace(trace)))
        if (isErrored(node.outcome)) return node.outcome.errored;
    return undefined;
}

export function verdictOf(trace: string): AccessVerdict {
    if (traceVerdict(trace) === true) return 'permitted';
    return exceptionMessage(trace) ? 'denied-exception' : 'denied';
}

/**
 * Gates whether `TraceViewer` shows the exception message beside the verdict
 * badge. A trace can carry an exception in a branch abandoned while the request
 * still succeeded, so gating on the message alone would put a red exception
 * next to a green `permitted` badge.
 */
export function showsException(result: AccessResult): boolean {
    return result.verdict === 'denied-exception' && !!result.message;
}

/**
 * Maps the endpoint's answer onto what the UI renders.
 *
 * `permitted` is authoritative and the trace is evidence: deriving the verdict
 * from the trace would let a parser slip flip a permit into a denial. The
 * scrape only tells `denied` from `denied-exception`, where it cannot change
 * the permit/deny answer.
 */
export function toAccessResult(response: {
    permitted: boolean;
    evaluation: AccessEvaluation | null;
}): AccessResult {
    if (response.evaluation === null)
        return { verdict: 'permitted', trace: null, parties: [] };

    const { trace, parties } = response.evaluation;
    if (response.permitted) return { verdict: 'permitted', trace, parties };

    const message = exceptionMessage(trace);
    return message
        ? { verdict: 'denied-exception', trace, parties, message }
        : { verdict: 'denied', trace, parties };
}
