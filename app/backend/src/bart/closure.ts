import { matches } from './matcher';
import { BartAttrs } from './types';

/** A party pattern the closure must load. An exchange's `any`/`all` participants and the
 *  parties a condition names both reduce to this; role and quantifier are wire detail. */
export type PartyPattern = { attrs: BartAttrs };

export type AnalyzeFn = (policyTexts: string[]) => Promise<PartyPattern[][]>;

/** Assembles one user's `.bart` policy text. */
export type PolicyTextFn = (userId: string) => Promise<string>;

/**
 * Which parties belong in the policy system for a request. Each round analyses the parties
 * not yet inspected and adds every user matching a party pattern found in them, until a round
 * adds nobody; it terminates because the set only grows and `index` bounds it.
 *
 * Exact in both directions, never a sample and never a superset: a missing party can turn an
 * `all:` denial into a permit, and an extra one that sorts earlier by id can capture the
 * `findFirst()` that resolves a condition's party reference.
 *
 * @returns party ids in policy-system order: seed first (so the caller is index 1), then
 *          everyone discovered, sorted by id for a reproducible `scenario` echo
 */
export async function partyClosure(args: {
    seed: string[];
    index: ReadonlyMap<string, BartAttrs>;
    analyze: AnalyzeFn;
    policyTextOf: PolicyTextFn;
}): Promise<string[]> {
    const { seed, index, analyze, policyTextOf } = args;

    const members = new Set<string>(seed);
    const analysed = new Set<string>();
    const discovered: string[] = [];

    for (;;) {
        const frontier = [...members].filter(id => !analysed.has(id));
        if (frontier.length === 0) break;

        const texts = await Promise.all(frontier.map(policyTextOf));
        const results = await analyze(texts);
        frontier.forEach(id => analysed.add(id));

        for (const patterns of results) {
            for (const pattern of patterns) {
                for (const [candidateId, attrs] of index) {
                    if (members.has(candidateId)) continue;
                    if (!matches(pattern.attrs, attrs)) continue;
                    members.add(candidateId);
                    discovered.push(candidateId);
                }
            }
        }
    }

    discovered.sort();
    return [...seed, ...discovered];
}
