import {
    assemblePolicySystem,
    evaluateAssembled,
    loadPartyIndex,
} from './assembly';
import { emitRequest, RequestTarget, USER_ID_ATTR } from './emitter';
import { EvaluationResult } from './evaluator.client';
import { matches } from './matcher';
import { BartAttrs } from './types';

export type AccessDecision = {
    permitted: boolean;
    evaluation: {
        parties: string[];
        requests: {
            requester: string;
            from: string;
            resource: Record<string, unknown>;
        }[];
        trace: string;
        scenario: string;
    } | null;
};

export async function decideAccess(
    callerId: string,
    resource: { id: string; attrs: BartAttrs; UserId: string },
): Promise<AccessDecision> {
    // The engine excludes the requester from its candidate policies, so a self-request
    // would deny.
    if (resource.UserId === callerId) {
        return { permitted: true, evaluation: null };
    }

    const system = await assemblePolicySystem([callerId, resource.UserId]);
    const requestLine = emitRequest(1, resource.attrs, {
        quantifier: 'any',
        attrs: { [USER_ID_ATTR]: resource.UserId },
    });
    const result = await evaluateAssembled(system, requestLine);

    return toDecision(system.parties, result);
}

/**
 * Decides a caller-composed request: "would anyone matching P grant me something matching Q?"
 *
 * No resource row, so no owner short-circuit and `evaluation` is never null. A permit is a
 * claim about a description; it makes nothing downloadable.
 *
 * The seed excludes the caller even when the caller's own attributes match the pattern: a
 * repeated id would appear twice and shift every later party's number.
 */
export async function decideCustomAccess(
    callerId: string,
    spec: { resource: BartAttrs; from: RequestTarget },
): Promise<AccessDecision> {
    const index = await loadPartyIndex();

    const targets = [...index]
        .filter(([id]) => id !== callerId)
        .filter(([, attrs]) => matches(spec.from.attrs, attrs))
        .map(([id]) => id);

    const system = await assemblePolicySystem([callerId, ...targets], index);
    const requestLine = emitRequest(1, spec.resource, spec.from);
    const result = await evaluateAssembled(system, requestLine);

    return toDecision(system.parties, result);
}

/** Maps an evaluator result onto the wire shape, resolving party numbers back to ids. */
export function toDecision(
    parties: string[],
    result: EvaluationResult,
): AccessDecision {
    return {
        permitted: result.permitted,
        evaluation: {
            parties,
            requests: result.requests.map(satisfied => ({
                requester: parties[satisfied.requester - 1],
                from: parties[satisfied.from - 1],
                resource: satisfied.resource,
            })),
            trace: result.trace,
            scenario: result.scenario,
        },
    };
}
