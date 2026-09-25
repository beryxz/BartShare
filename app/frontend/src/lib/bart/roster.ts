import { PartyRef } from './diagram';

/** What the roster says about one party. `candidate` matched a fan's pattern
 *  and was never asked; `absent` was loaded by the closure and matched nothing. */
export type PartyStatus = 'requester' | 'involved' | 'candidate' | 'absent';

/** The roster's copy, kept beside the type so wording is testable. */
export const STATUS_LABEL: Record<PartyStatus, string> = {
    requester: 'requester',
    involved: 'involved',
    candidate: 'matched, never asked',
    absent: 'loaded, never asked',
};

/**
 * Party 1 is the requester by construction: the closure is seeded with the
 * caller first. A role, not a drawing outcome, so it outranks the rest even
 * when the trace could not be drawn at all. `matched` is `matchedParties`.
 */
export function partyStatus(
    party: PartyRef,
    matched: Set<number>,
): PartyStatus {
    if (party.index === 1) return 'requester';
    if (party.lane !== null) return 'involved';
    return matched.has(party.index) ? 'candidate' : 'absent';
}

/** `3 parties, 1 not involved`. The second clause appears only when a lane was
 *  hidden, so a diagram hiding nobody advertises no distinction. */
export function rosterSummary(parties: PartyRef[]): string {
    const total = `${parties.length} ${parties.length === 1 ? 'party' : 'parties'}`;
    const hidden = parties.filter(party => party.lane === null).length;
    return hidden === 0 ? total : `${total}, ${hidden} not involved`;
}
