import { BartAttrs } from '../types';

/** Everything a provider may need that is not a party id. Snapshotted once per evaluation
 *  so that every party sees the same instant. */
export type EvalContext = { now: Date };

/** One context attribute. Documented per key, not per provider: `dateProvider` emits several
 *  keys meaning different things, and a shared description drifts from all of them. */
export type ContextKeyDoc = {
    /** The attribute key itself, e.g. `date_month`. Feeds `providerKeys()`. */
    readonly name: string;
    /** One sentence, shown in the UI beside the key. */
    readonly description: string;
    /** A condition fragment a user could paste into a rule. */
    readonly example: string;
};

/**
 * Contributes context attributes for a set of parties. Bart's context is per-party, so a
 * provider returns a map keyed by party id rather than one object, and `contribute` takes the
 * whole list so it can answer with a single query.
 */
export interface ContextProvider {
    /** Used in collision errors. */
    readonly name: string;
    /** Exactly the keys `contribute` emits. Feeds the reserved-name blacklist. */
    readonly keys: readonly ContextKeyDoc[];
    contribute(
        partyIds: string[],
        evalCtx: EvalContext,
    ): Promise<Map<string, BartAttrs>>;
}
