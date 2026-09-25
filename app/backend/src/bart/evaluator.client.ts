import config from '../config';
import { PartyPattern } from './closure';
import { BartAttrs } from './types';

/** One `any`/`all` participant of an exchange, as `/analyze/policies` reports it. */
type QuantifiedPattern = {
    role: string;
    quant: string;
    attrs: BartAttrs;
};

/** One party a rule condition names by attribute pattern. */
type ConditionParty = { attrs: BartAttrs };

/** The evaluator could not be reached, did not answer in time, or failed inside itself. */
export class EvaluatorUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EvaluatorUnavailableError';
    }
}

/** The evaluator answered 4xx: it read the input and said it was bad. */
export class EvaluatorRejectedError extends Error {
    readonly slug: string;
    readonly location: string | null;
    readonly detail: string;

    constructor(slug: string, detail: string, location: string | null) {
        super(`evaluator rejected the input (${slug}): ${detail}`);
        this.name = 'EvaluatorRejectedError';
        this.slug = slug;
        this.detail = detail;
        this.location = location;
    }
}

/** An HTTP-shaped answer for one of the two failure modes callers branch on. */
export type MappedEvaluatorError = { status: 500 | 503; errors: string[] };

/**
 * Maps the two evaluator errors to the response a caller should send, `null` for anything
 * else so a caller can fall through to `throw error`.
 *
 * `EvaluatorUnavailableError.message` embeds `EVALUATOR_URL` and is never forwarded: some
 * call sites (`POST /users`) are public. `detail` comes from the evaluator's own body.
 */
export function mapEvaluatorError(error: unknown): MappedEvaluatorError | null {
    if (error instanceof EvaluatorUnavailableError) {
        return { status: 503, errors: ['Evaluator service unavailable'] };
    }
    if (error instanceof EvaluatorRejectedError) {
        return {
            status: 500,
            errors: [`Invalid stored policy (${error.slug}): ${error.detail}`],
        };
    }
    return null;
}

export type SatisfiedRequest = {
    requester: number;
    from: number;
    resource: Record<string, unknown>;
};
export type EvaluationResult = {
    permitted: boolean;
    requests: SatisfiedRequest[];
    trace: string;
    scenario: string;
};
export type ValidationOutcome = {
    valid: boolean;
    error?: { line: number | null; column: number | null; message: string };
};

/**
 * Reads an error body without being fooled by the two shapes the service can produce.
 *
 * `ApiError` is `{error, detail, location?, syntax?}` where `error` is a slug; Spring's
 * default body is `{timestamp, status, error, path}` where `error` is a human phrase. They
 * share the field name, so the presence of `detail` decides whether `error` is a slug.
 *
 * The `??` fallbacks are not dead code: the probe proves only that the body is not Spring's
 * shape, and a proxy or a version skew can produce `detail` without `error`.
 */
function rejection(status: number, body: unknown): EvaluatorRejectedError {
    if (body !== null && typeof body === 'object' && 'detail' in body) {
        const apiError = body as {
            error?: string;
            detail?: string;
            location?: string;
        };
        return new EvaluatorRejectedError(
            apiError.error ?? 'unknown',
            apiError.detail ?? '',
            apiError.location ?? null,
        );
    }
    return new EvaluatorRejectedError(
        'unknown',
        `evaluator returned ${status}`,
        null,
    );
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${config.EVALUATOR_URL}${path}`, {
            ...init,
            signal: AbortSignal.timeout(config.EVALUATOR_TIMEOUT_MS),
        });
    } catch (error) {
        throw new EvaluatorUnavailableError(
            `could not reach the evaluator at ${config.EVALUATOR_URL}${path}: ${String(error)}`,
        );
    }

    if (!response.ok) {
        // Only the mapped 400s and 404s carry a slug: a 5xx is the service failing, and a
        // caller that skips a rejected policy must not skip on an outage and answer 200.
        if (response.status >= 500) {
            throw new EvaluatorUnavailableError(
                `evaluator at ${config.EVALUATOR_URL}${path} ` +
                    `failed with status ${response.status}`,
            );
        }
        let body: unknown = null;
        try {
            body = await response.json();
        } catch {
            // a non-JSON error body tells us nothing beyond the status
        }
        throw rejection(response.status, body);
    }

    // `fetch` resolves once headers arrive, so a mid-stream timeout, dropped connection,
    // or non-JSON 200 surfaces here, mapped to 503 rather than a rejection.
    try {
        return (await response.json()) as T;
    } catch (error) {
        throw new EvaluatorUnavailableError(
            `evaluator response from ${config.EVALUATOR_URL}${path} ` +
                `could not be read: ${String(error)}`,
        );
    }
}

function jsonPost(body: unknown): RequestInit {
    return {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    };
}

/** Batched: one round trip per closure round, not one per policy. */
export async function analyzePolicies(
    policyTexts: string[],
): Promise<PartyPattern[][]> {
    const body = await call<{
        policies: {
            quantified: QuantifiedPattern[];
            conditionParties: ConditionParty[];
        }[];
    }>('/analyze/policies', jsonPost({ policies: policyTexts }));
    // Both lists answer "which parties must be loaded", so the closure gets one flat
    // list; `role`/`quant` are exchange detail it does not consult.
    return body.policies.map(entry => [
        ...entry.quantified.map(pattern => ({ attrs: pattern.attrs })),
        ...entry.conditionParties.map(party => ({ attrs: party.attrs })),
    ]);
}

/** A rejection here is the endpoint's finding, not a failed call: `/validate` answers 200
 *  either way, so an invalid policy comes back as data. */
export async function validatePolicy(
    policyText: string,
): Promise<ValidationOutcome> {
    return call<ValidationOutcome>('/validate/policy', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: policyText,
    });
}

export async function evaluate(body: {
    policies: string[];
    context: string;
    request: string;
}): Promise<EvaluationResult> {
    return call<EvaluationResult>('/evaluate', jsonPost(body));
}

/**
 * Liveness probe for the evaluator, for `GET /dev/status`. Goes through `call` so it inherits
 * `EVALUATOR_TIMEOUT_MS` and the `EvaluatorUnavailableError` path, and reports an outage the
 * same way the calls it exists to explain do. Reaching it at all is the whole result.
 */
export async function health(): Promise<void> {
    await call<{ status: string }>('/health', { method: 'GET' });
}
