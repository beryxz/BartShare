import { describe, expect, it } from 'vitest';
import { causeOf } from './causes';
import { parseTrace } from './trace';

/** The single root of a one-request trace fragment. */
function node(raw: string) {
    const [root] = parseTrace(raw);
    return root;
}

describe('causeOf', () => {
    it('reports a false condition with the rule’s own description', () => {
        const cause = causeOf([
            node(`evaluating Request[requester=2, resource=[(type : exercises)], from=1]
  policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
    rule 1.2: resource match([(type : exercises)], [(type : exercises), (course : programming)]) -> true
    rule 1.2: condition requester.username in friends -> false`),
        ]);
        expect(cause).toEqual({
            text: 'condition false · requester.username in friends',
            tone: 'deny',
        });
    });

    it('reports an errored condition ahead of any other cause', () => {
        // The engine swallows a condition exception and calls it a deny, so
        // this is the one cause that would otherwise vanish entirely.
        const cause = causeOf([
            node(`evaluating Request[requester=2, resource=[(type : exercises)], from=1]
  policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
    rule 1.1: resource match([(type : exercises)], [(type : lectureNotes)]) -> false
    rule 1.2: condition requester.age > limit -> java.lang.NullPointerException: limit is undefined`),
        ]);
        expect(cause).toEqual({
            text: 'condition errored · java.lang.NullPointerException: limit is undefined',
            tone: 'deny',
        });
    });

    it('reports that no rule offers the resource when every match failed', () => {
        const cause = causeOf([
            node(`evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
  policy 1: evaluating Request[requester=2, resource=[(type : lectureNotes)], from=1]
    rule 1.1: resource match([(type : lectureNotes)], [(type : exercises), (course : calculus)]) -> false`),
        ]);
        expect(cause).toEqual({
            text: 'no rule offers lectureNotes',
            tone: 'deny',
        });
    });

    it('does not blame the resource when some rule did match it', () => {
        // A rule matched and its condition failed; blaming the resource would
        // point the reader at the wrong line entirely.
        const cause = causeOf([
            node(`evaluating Request[requester=2, resource=[(type : exercises)], from=1]
  policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
    rule 1.1: resource match([(type : exercises)], [(type : lectureNotes)]) -> false
    rule 1.2: resource match([(type : exercises)], [(type : exercises)]) -> true
    rule 1.2: condition requester.username in friends -> false`),
        ]);
        expect(cause?.text).toBe(
            'condition false · requester.username in friends',
        );
    });

    it('reports an empty quantified from as no party matched', () => {
        const cause = causeOf([
            node(`evaluating Request[requester=1, resource=[(type : exercises)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : exercises)], from=2]
    rule 2.1: not satisfied: no one from exchange`),
        ]);
        expect(cause).toEqual({ text: 'no party matched', tone: 'deny' });
    });

    it('warns on a vacuous permit, which is not a failure at all', () => {
        const cause = causeOf([
            node(`evaluating Request[requester=1, resource=[(type : exercises)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : exercises)], from=2]
    rule 2.1: satisfied: no one to exchange`),
        ]);
        expect(cause).toEqual({
            text: 'nobody to exchange with',
            tone: 'warn',
        });
    });

    it('returns null when nothing in the subtree explains the outcome', () => {
        const cause = causeOf([
            node(`evaluating Request[requester=1, resource=[(type : exercises)], from=2]
  finding matching policies`),
        ]);
        expect(cause).toBeNull();
    });
});
