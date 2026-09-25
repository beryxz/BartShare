import { apiGet, apiSend } from '@/lib/api/client';
import {
    AccessEvaluation,
    AccessResponse,
    AccessResult,
} from '@/lib/api/types';
import { BartAttrs } from '@/lib/bart/types';
import { toAccessResult } from './verdict';

/**
 * GET because the endpoint answers a question: a denial is a `200 {permitted:
 * false}`, never an `ApiError`. Not SWR-cached either, since caching a verdict
 * would store a grant.
 */
export async function requestAccess(resourceId: string): Promise<AccessResult> {
    return toAccessResult(
        await apiGet<AccessResponse>(`/resources/${resourceId}/access`),
    );
}

export type CustomRequestBody = {
    resource: BartAttrs;
    from: { quantifier: 'any' | 'all'; attrs: BartAttrs };
};

/**
 * Evaluates a caller-composed request against the whole policy system rather
 * than a stored row: a coarse resource pattern and an `any`/`all` party
 * pattern, the paper's request line. With no stored resource there is no owner
 * short-circuit, so `evaluation` is never null.
 */
export async function customRequest(
    body: CustomRequestBody,
): Promise<AccessResult> {
    return toAccessResult(
        await apiSend<{ permitted: boolean; evaluation: AccessEvaluation }>(
            'POST',
            '/resources/access',
            body,
        ),
    );
}
