/**
 * Phrasing for the count objects the dev endpoints return. Same reasoning as
 * `describeAccountSummary` (`src/features/policy/accountSummary.ts`): a kind
 * with nothing in it is omitted rather than shown as "0 groups", since a zero
 * is noise and an empty result means "nothing at all" in words instead.
 *
 * `users` reads as "parties": the backend's field name follows its table,
 * but the UI's vocabulary is Bart's.
 */
export type CountKind = [key: string, noun: string];

export const CREATED_KINDS: CountKind[] = [
    ['users', 'party'],
    ['resources', 'resource'],
    ['connections', 'connection'],
    ['groups', 'group'],
];

/** English plurals for the nouns here that are not just "+s". */
function plural(noun: string): string {
    return noun === 'party' ? 'parties' : `${noun}s`;
}

export function describeCounts(
    counts: Record<string, number>,
    kinds: CountKind[],
): string[] {
    return kinds
        .filter(([key]) => (counts[key] ?? 0) > 0)
        .map(([key, noun]) => {
            const count = counts[key];
            return `${count} ${count === 1 ? noun : plural(noun)}`;
        });
}
