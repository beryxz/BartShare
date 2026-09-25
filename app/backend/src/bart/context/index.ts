import { emitAttrList } from '../emitter';
import { BartAttrs } from '../types';
import { connectionsProvider } from './connections.provider';
import { dateProvider } from './date.provider';
import { groupsProvider } from './groups.provider';
import { ContextKeyDoc, ContextProvider, EvalContext } from './provider';

export { ContextKeyDoc, ContextProvider, EvalContext };

/** The registry. Append here to add context; nothing else needs to change. */
export const CONTEXT_PROVIDERS: readonly ContextProvider[] = [
    dateProvider,
    connectionsProvider,
    groupsProvider,
];

/** Every key any provider emits: the source of the reserved-name blacklist. */
export function providerKeys(): string[] {
    return CONTEXT_PROVIDERS.flatMap(provider =>
        provider.keys.map(key => key.name),
    );
}

/**
 * Merges every provider's contribution for one party into a single attribute bag, throwing if
 * two providers claim the same key rather than letting a later one silently win. Shared by
 * `buildContextTuple` and `buildContextReport` so both answer "what will the evaluator see"
 * the same way.
 */
export function mergeContributions(
    partyId: string,
    contributions: readonly Map<string, BartAttrs>[],
    providers: readonly ContextProvider[],
): BartAttrs {
    const merged: BartAttrs = {};
    contributions.forEach((contribution, i) => {
        const provider = providers[i];
        const attrs = contribution.get(partyId) ?? {};
        for (const [key, value] of Object.entries(attrs)) {
            if (key in merged)
                throw new Error(
                    `context providers collide on '${key}' (${provider.name})`,
                );
            merged[key] = value;
        }
    });
    return merged;
}

/**
 * Builds the `.bart` context tuple: one attribute list per party, in party order. Arity equals
 * `partyIds.length` by construction, as the evaluator's `context-arity` check requires: a
 * padded short tuple would shift every later party's attributes instead of erroring.
 */
export async function buildContextTuple(
    partyIds: string[],
    evalCtx: EvalContext,
    providers: readonly ContextProvider[] = CONTEXT_PROVIDERS,
): Promise<string> {
    const contributions = await Promise.all(
        providers.map(provider => provider.contribute(partyIds, evalCtx)),
    );

    const slots = partyIds.map(partyId =>
        emitAttrList(mergeContributions(partyId, contributions, providers)),
    );

    return `(${slots.join(',')})`;
}
