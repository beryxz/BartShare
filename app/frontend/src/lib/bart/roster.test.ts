import { describe, expect, it } from 'vitest';
import { PartyRef } from './diagram';
import { partyStatus, rosterSummary, STATUS_LABEL } from './roster';

function party(index: number, lane: number | null): PartyRef {
    return { index, id: `id-${index}`, label: `party-${index}`, lane };
}

describe('partyStatus', () => {
    it('calls party 1 the requester', () => {
        expect(partyStatus(party(1, 1), new Set())).toBe('requester');
    });

    it('still calls party 1 the requester when nothing was drawn', () => {
        // `requester` is a role, true whether or not the trace could be
        // drawn, so it outranks the drawing-derived statuses.
        expect(partyStatus(party(1, null), new Set())).toBe('requester');
    });

    it('calls a laned party involved', () => {
        expect(partyStatus(party(2, 2), new Set())).toBe('involved');
    });

    it('calls an unlaned party a fan matched a candidate', () => {
        expect(partyStatus(party(3, null), new Set([3]))).toBe('candidate');
    });

    it('calls an unlaned party no fan matched absent', () => {
        expect(partyStatus(party(3, null), new Set([2]))).toBe('absent');
    });

    it('prefers involved over candidate for a party that is both', () => {
        // Being asked is the stronger fact, and the diagram already shows it.
        expect(partyStatus(party(2, 2), new Set([2]))).toBe('involved');
    });
});

describe('STATUS_LABEL', () => {
    it('spells out what an absent party actually is', () => {
        expect(STATUS_LABEL.absent).toBe('loaded, never asked');
    });

    it('separates a weighed party from one never reached', () => {
        expect(STATUS_LABEL.candidate).toBe('matched, never asked');
    });
});

describe('rosterSummary', () => {
    it('names the hidden count when something was hidden', () => {
        expect(rosterSummary([party(1, 1), party(2, 2), party(3, null)])).toBe(
            '3 parties, 1 not involved',
        );
    });

    it('says nothing about hiding when nothing was hidden', () => {
        // A diagram that hides nobody must not advertise a distinction that
        // never arose.
        expect(rosterSummary([party(1, 1), party(2, 2)])).toBe('2 parties');
    });

    it('counts more than one hidden party', () => {
        expect(
            rosterSummary([party(1, 1), party(2, null), party(3, null)]),
        ).toBe('3 parties, 2 not involved');
    });

    it('uses the singular for one party', () => {
        expect(rosterSummary([party(1, 1)])).toBe('1 party');
    });
});
