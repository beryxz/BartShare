/**
 * What `DELETE /me` will destroy, as counts.
 *
 * The backend deletes the user's resources, both directions of every
 * connection, and all group memberships in one transaction, so these numbers
 * are everything that goes.
 */
export type AccountSummary = {
    resources: number;
    connections: number;
    groups: number;
};

const KINDS: [keyof AccountSummary, string][] = [
    ['resources', 'resource'],
    ['connections', 'connection'],
    ['groups', 'group'],
];

/**
 * The counts as phrases for the confirm dialog.
 *
 * A kind the user has none of is omitted rather than rendered as "0 groups", so
 * an empty result means "nothing but the party itself" and the dialog has to
 * say so in words.
 */
export function describeAccountSummary(summary: AccountSummary): string[] {
    return KINDS.filter(([key]) => summary[key] > 0).map(([key, noun]) => {
        const count = summary[key];
        return `${count} ${noun}${count === 1 ? '' : 's'}`;
    });
}
