import { User } from '../models/models';
import { AnalyzeFn, partyClosure } from './closure';
import { buildContextTuple } from './context';
import { emitPolicy, partyAttrsOf } from './emitter';
import {
    analyzePolicies,
    evaluate,
    EvaluationResult,
    EvaluatorRejectedError,
} from './evaluator.client';
import { BartAttrs } from './types';

const LOCATION_RE = /^policy (\d+)$/;

/**
 * `"policy 2"` -> the user id owning the second entry of `texts`, via `textOwners`.
 *
 * `location` is meaningless outside the request that produced it: both `/analyze/policies`
 * and `/evaluate` number it against the batch of policy texts they were just sent. `null`
 * covers every way it can fail to resolve.
 */
export function userForLocation(
    location: string | null,
    texts: readonly string[],
    textOwners: ReadonlyMap<string, string>,
): string | null {
    const match = LOCATION_RE.exec(location ?? '');
    if (match === null) return null;
    const text = texts[Number(match[1]) - 1];
    return text === undefined ? null : (textOwners.get(text) ?? null);
}

/**
 * Runs one evaluator call; on `EvaluatorRejectedError`, resolves `error.location` against
 * `texts`/`textOwners` and re-raises with the offending user appended to `detail`. An
 * unresolvable location passes through unchanged.
 */
export async function callBlaming<T>(
    call: () => Promise<T>,
    texts: readonly string[],
    textOwners: ReadonlyMap<string, string>,
): Promise<T> {
    try {
        return await call();
    } catch (error) {
        if (!(error instanceof EvaluatorRejectedError)) throw error;
        const blamed = userForLocation(error.location, texts, textOwners);
        throw blamed === null
            ? error
            : new EvaluatorRejectedError(
                  error.slug,
                  `${error.detail} (user ${blamed})`,
                  error.location,
              );
    }
}

/** A policy system ready to evaluate, plus what is needed to blame a rejection. */
export type AssembledSystem = {
    /** Party ids in policy-system order; index + 1 is the Bart party number. */
    parties: string[];
    policies: string[];
    context: string;
    textOwners: ReadonlyMap<string, string>;
};

/**
 * Every user's party attributes, keyed by id, via `partyAttrsOf` rather than the raw row:
 * that is exactly what the closure matches quantified patterns against. Exposed separately so
 * a caller that assembles several systems over the same population loads it once.
 */
export async function loadPartyIndex(): Promise<Map<string, BartAttrs>> {
    const allUsers = await User.findAll({ attributes: ['id', 'attrs'] });
    return new Map(
        allUsers.map(user => [
            user.id,
            partyAttrsOf({ id: user.id, attrs: user.attrs as BartAttrs }),
        ]),
    );
}

/**
 * Builds the policy system for a request: closure, policy texts, context tuple. `seed[0]`
 * becomes party 1, so callers put the requester first.
 *
 * No transaction, deliberately: the context providers issue their own queries and the closure
 * makes external HTTP calls, so the snapshot would be partial and held open across them.
 */
export async function assemblePolicySystem(
    seed: string[],
    index?: ReadonlyMap<string, BartAttrs>,
): Promise<AssembledSystem> {
    const partyIndex = index ?? (await loadPartyIndex());

    const textOwners = new Map<string, string>();
    const policyTextOf = async (userId: string): Promise<string> => {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'attrs', 'rules'],
        });
        const text =
            user === null
                ? emitPolicy({ id: userId, attrs: {}, rules: [] })
                : emitPolicy({
                      id: user.id,
                      attrs: user.attrs as BartAttrs,
                      rules: user.rules,
                  });
        textOwners.set(text, userId);
        return text;
    };

    const analyzeWithBlame: AnalyzeFn = texts =>
        callBlaming(() => analyzePolicies(texts), texts, textOwners);

    const parties = await partyClosure({
        seed,
        index: partyIndex,
        analyze: analyzeWithBlame,
        policyTextOf,
    });

    const rows = await User.findAll({
        where: { id: parties },
        attributes: ['id', 'attrs', 'rules'],
    });
    const byId = new Map(rows.map(row => [row.id, row]));

    const policies = parties.map(partyId => {
        const row = byId.get(partyId);
        // A party that vanished since the closure still needs an entry: omitting
        // one degrades into a silent deny.
        return row === undefined
            ? emitPolicy({ id: partyId, attrs: {}, rules: [] })
            : emitPolicy({
                  id: row.id,
                  attrs: row.attrs as BartAttrs,
                  rules: row.rules,
              });
    });

    const context = await buildContextTuple(parties, { now: new Date() });

    return { parties, policies, context, textOwners };
}

/** Evaluates one request line against an assembled system, blaming rejections on a user. */
export async function evaluateAssembled(
    system: AssembledSystem,
    requestLine: string,
): Promise<EvaluationResult> {
    return callBlaming(
        () =>
            evaluate({
                policies: system.policies,
                context: system.context,
                request: requestLine,
            }),
        system.policies,
        system.textOwners,
    );
}
