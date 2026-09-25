import { FastifyInstance } from 'fastify';
import { Op } from 'sequelize';
import { APP_LIMITS } from '../config';
import { Resource } from '../models/models';
import {
    whereAttrContains,
    whereJsonSubstring,
} from '../utils/controllers.utils';
import { log, mapWithConcurrency } from '../utils/general.utils';
import { RESOURCE_VIEW_ATTRIBUTES } from '../utils/resources.utils';
import {
    AssembledSystem,
    assemblePolicySystem,
    evaluateAssembled,
    loadPartyIndex,
} from './assembly';
import { emitRequest, USER_ID_ATTR } from './emitter';
import { EvaluatorRejectedError } from './evaluator.client';
import { BartAttrs } from './types';

export type SharedScan = {
    resources: Resource[];
    considered: number;
    total: number;
    truncated: boolean;
};

/**
 * Every resource the caller does not own that the engine permits right now. There are no
 * stored grants, so this is a live evaluation per candidate rather than a lookup.
 *
 * Never narrow the candidate set by relationship: Bart grants by attribute, so filtering on
 * the caller's connections would hide resources the engine genuinely permits.
 *
 * `fastify` is required, not optional: `whereJsonSubstring` needs the dialect, and defaulting
 * it would silently drop `filters.name`.
 */
export async function decideSharedWith(
    callerId: string,
    filters: { name?: string; attr?: string } = {},
    fastify: FastifyInstance,
): Promise<SharedScan> {
    const limit = APP_LIMITS.resources.maxSharedCandidates;

    const candidateWhere = {
        UserId: { [Op.ne]: callerId },
        ...whereJsonSubstring(fastify, 'metadata.name', filters.name),
        ...whereAttrContains('attrs', filters.attr),
    };

    const total = await Resource.count({
        where: candidateWhere,
    });
    const candidates = await Resource.findAll({
        where: candidateWhere,
        attributes: [...RESOURCE_VIEW_ATTRIBUTES, 'UserId'],
        order: [
            ['createdAt', 'DESC'],
            ['id', 'ASC'],
        ],
        limit,
    });

    const index = await loadPartyIndex();
    const systems = new Map<string, Promise<AssembledSystem>>();
    const systemFor = (ownerId: string): Promise<AssembledSystem> => {
        // Memoise the promise, not the value: concurrent workers on the same
        // owner must await one assembly, not race two.
        let pending = systems.get(ownerId);
        if (pending === undefined) {
            pending = assemblePolicySystem([callerId, ownerId], index);
            systems.set(ownerId, pending);
        }
        return pending;
    };

    const verdicts = await mapWithConcurrency(
        candidates,
        APP_LIMITS.resources.sharedConcurrency,
        async resource => {
            let system: AssembledSystem;
            try {
                system = await systemFor(resource.UserId);
            } catch (error) {
                // A bad stored policy fails this owner's whole assembly, but must
                // not blank the page. An outage propagates instead, for a 503.
                if (error instanceof EvaluatorRejectedError) {
                    log(
                        `[shared] skipping ${resource.id}: assembly for owner ${resource.UserId} rejected: ${error.message}`,
                    );
                    return false;
                }
                throw error;
            }

            const requestLine = emitRequest(1, resource.attrs as BartAttrs, {
                quantifier: 'any',
                attrs: { [USER_ID_ATTR]: resource.UserId },
            });
            try {
                const result = await evaluateAssembled(system, requestLine);
                return result.permitted;
            } catch (error) {
                // Same split as the assembly above: a rejection skips this row,
                // an outage propagates.
                if (error instanceof EvaluatorRejectedError) {
                    log(
                        `[shared] skipping ${resource.id}: evaluate rejected: ${error.message}`,
                    );
                    return false;
                }
                throw error;
            }
        },
    );

    return {
        resources: candidates.filter((_, i) => verdicts[i]),
        considered: candidates.length,
        total,
        truncated: total > candidates.length,
    };
}
