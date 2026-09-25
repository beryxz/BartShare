import { ApiError } from './client';

/**
 * Every user-visible message for a failed write. The backend answers with one
 * message per problem (a `400` names every offending attribute key, a rule
 * syntax error carries `line L:C`), so the array is the payload.
 */
export function errorMessages(error: unknown): string[] {
    if (error instanceof ApiError) return error.errors;
    if (error instanceof Error) return [error.message];
    return [String(error)];
}

/**
 * True when a failed write means the row on screen is stale rather than
 * correctable. Group membership is open, so `404` is another member having
 * deleted the group and `403` is this user having left it in another tab; both
 * want a revalidation, and reporting them into a form invites a doomed retry.
 */
export function isStaleWriteError(error: unknown): boolean {
    return (
        error instanceof ApiError &&
        (error.status === 403 || error.status === 404)
    );
}

/**
 * What to tell the user for a stale write; check `isStaleWriteError` first,
 * since this says nothing useful about any other status. Names the race rather
 * than repeating the backend's "Not authorized", which reads as user error on
 * a screen whose header says any member may edit or delete a group.
 */
export function staleWriteMessage(error: unknown): string {
    return error instanceof ApiError && error.status === 404
        ? 'That group no longer exists: the list has been refreshed.'
        : 'That group changed on the server: the list has been refreshed.';
}

/**
 * Removes a `line L:C` position from an evaluator error.
 *
 * The server validates the whole emitted policy document, so its coordinates
 * point at the wrong place in a sheet editing one rule, where the client's
 * own parse banner already carries a rule-relative one. Translating would
 * need the rule's offset within that document, which is server knowledge.
 * Anchored to `line N:N`, so a sentence mentioning a line number survives.
 */
export function stripRulePosition(message: string): string {
    return message.replace(/\bline \d+:\d+\s*/i, '');
}
