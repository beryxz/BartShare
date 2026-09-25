import {
    CONDITION_ERROR_TRACE,
    STUDENTS_TRACE,
} from '@/lib/bart/trace.fixture';
import { describe, expect, it } from 'vitest';
import {
    exceptionMessage,
    showsException,
    toAccessResult,
    verdictOf,
} from './verdict';

const WITH_EXCEPTION = `evaluating Request[requester=1, resource=[(type : x)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : x)], from=2]
    rule 2.1: resource match([(type : x)], [(type : x)]) -> true
    rule 2.1: condition y in friends -> BartTypeException: in: friends is a String, not a set
result: false
`;

describe('verdictOf', () => {
    it('reads a permit', () => {
        expect(verdictOf(STUDENTS_TRACE)).toBe('permitted');
    });

    it('reads a plain deny', () => {
        expect(verdictOf('result: false\n')).toBe('denied');
    });

    it('distinguishes a deny caused by a swallowed exception', () => {
        expect(verdictOf(WITH_EXCEPTION)).toBe('denied-exception');
    });

    it('treats an unreadable trace as a plain deny, never a permit', () => {
        expect(verdictOf('')).toBe('denied');
        expect(verdictOf('nonsense')).toBe('denied');
    });

    it('reports permitted when an abandoned branch threw', () => {
        const ABANDONED_BRANCH = `evaluating Request[requester=1, resource=[(type : x)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : x)], from=2]
    rule 2.1: resource match([(type : x)], [(type : x)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating OR(Exchange[to=ME, resource=[(type : a)], from=REQUESTER], Exchange[to=ME, resource=[(type : b)], from=REQUESTER])
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : a)], from=REQUESTER]
      evaluating Request[requester=2, resource=[(type : a)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : a)], from=1]
          rule 1.1: condition y in friends -> BartTypeException: in: friends is a String, not a set
      result: false
    rule 2.1: OR
      rule 2.1: evaluating Exchange[to=ME, resource=[(type : b)], from=REQUESTER]
      evaluating Request[requester=2, resource=[(type : b)], from=1]
        policy 1: evaluating Request[requester=2, resource=[(type : b)], from=1]
          rule 1.1: condition true -> true
      result: true
    rule 2.1: END Exchange -> true
result: true
`;
        expect(verdictOf(ABANDONED_BRANCH)).toBe('permitted');
    });
});

describe('exceptionMessage', () => {
    it('recovers the exception text when present', () => {
        // `Semantics` formats `e.getMessage()` and nothing else, so a leading
        // `SomeException: ` is part of the message, not a type to split off.
        expect(exceptionMessage(WITH_EXCEPTION)).toBe(
            'BartTypeException: in: friends is a String, not a set',
        );
    });

    it('returns undefined when there is nothing to recover', () => {
        expect(exceptionMessage(STUDENTS_TRACE)).toBeUndefined();
        expect(exceptionMessage('')).toBeUndefined();
    });

    it('ignores an exception-like string inside a quoted value', () => {
        const QUOTED_EXCEPTION = `evaluating Request[requester=1, resource=[(type : x)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : x)], from=2]
    rule 2.1: resource match([(type : x)], [(type : x)]) -> true
    rule 2.1: condition username == "BartTypeException: fake, not real" -> false
result: false
`;
        expect(exceptionMessage(QUOTED_EXCEPTION)).toBeUndefined();
        expect(verdictOf(QUOTED_EXCEPTION)).toBe('denied');
    });
});

describe('showsException', () => {
    it('hides the exception message beside a permitted verdict, even if one is present', () => {
        expect(
            showsException({
                verdict: 'permitted',
                trace: STUDENTS_TRACE,
                message: 'in: friends is a String, not a set',
                parties: [],
            }),
        ).toBe(false);
    });

    it('shows the exception message for a denied-exception verdict that has one', () => {
        expect(
            showsException({
                verdict: 'denied-exception',
                trace: '',
                message: 'in: friends is a String, not a set',
                parties: [],
            }),
        ).toBe(true);
    });

    it('returns false for a denied-exception verdict with no message', () => {
        expect(
            showsException({
                verdict: 'denied-exception',
                trace: '',
                parties: [],
            }),
        ).toBe(false);
    });
});

describe('toAccessResult', () => {
    const evaluation = (trace: string) => ({
        parties: ['u1', 'u2'],
        requests: [],
        trace,
        scenario: '',
    });

    it('treats the owner short-circuit as permitted with no trace', () => {
        // The backend never calls the evaluator for a resource you own, so
        // there is no trace and nothing to scrape.
        expect(
            toAccessResult({
                permitted: true,
                evaluation: null,
            }),
        ).toEqual({ verdict: 'permitted', trace: null, parties: [] });
    });

    it('reports a permit with its trace', () => {
        const result = toAccessResult({
            permitted: true,
            evaluation: evaluation(STUDENTS_TRACE),
        });
        expect(result.verdict).toBe('permitted');
        expect(result.trace).toBe(STUDENTS_TRACE);
    });

    it('trusts permitted over anything the trace says', () => {
        // `permitted` is authoritative and the trace only evidence: this
        // trace parses as a denial, yet the verdict must still be a permit.
        const result = toAccessResult({
            permitted: true,
            evaluation: evaluation('result: false\n'),
        });
        expect(result.verdict).toBe('permitted');
    });

    it('reports a plain denial', () => {
        const result = toAccessResult({
            permitted: false,
            evaluation: evaluation('result: false\n'),
        });
        expect(result).toEqual({
            verdict: 'denied',
            trace: 'result: false\n',
            parties: ['u1', 'u2'],
        });
    });

    it('recovers an exception behind a denial', () => {
        const trace =
            'rule 2.1: condition y in friends -> ' +
            'BartTypeException: in: friends is a String, not a set\n' +
            'result: false\n';
        const result = toAccessResult({
            permitted: false,
            evaluation: evaluation(trace),
        });
        expect(result.verdict).toBe('denied-exception');
        expect(result.message).toBe(
            'BartTypeException: in: friends is a String, not a set',
        );
    });

    it('never reports denied-exception for a permit', () => {
        // An exception can sit in a branch the engine abandoned while the
        // request still succeeded overall.
        const trace =
            'rule 1.1: condition y in friends -> ' +
            'BartTypeException: boom\n' +
            'result: true\n';
        const result = toAccessResult({
            permitted: true,
            evaluation: evaluation(trace),
        });
        expect(result.verdict).toBe('permitted');
        expect(result.message).toBeUndefined();
    });

    describe('parties', () => {
        it('carries the evaluation parties in order', () => {
            const result = toAccessResult({
                permitted: true,
                evaluation: {
                    parties: ['david-id', 'john-id', 'mary-id'],
                    requests: [],
                    trace: STUDENTS_TRACE,
                    scenario: '',
                },
            });
            expect(result.parties).toEqual(['david-id', 'john-id', 'mary-id']);
        });

        // The only denial-path test supplying its own `parties` rather than
        // the shared fixture, proving they're threaded, not closed over.
        it("threads the evaluation's own parties through a denial", () => {
            const result = toAccessResult({
                permitted: false,
                evaluation: {
                    parties: ['a', 'b'],
                    requests: [],
                    trace: 'result: false\n',
                    scenario: '',
                },
            });
            expect(result.verdict).toBe('denied');
            expect(result.parties).toEqual(['a', 'b']);
        });
    });
});

describe('a genuine engine exception', () => {
    // The shape the engine actually emits: no `-> SomeException:` prefix,
    // which the recovery pattern must handle without one.
    it('recovers the message', () => {
        expect(exceptionMessage(CONDITION_ERROR_TRACE)).toBe(
            'Undefined name: testGroup',
        );
    });

    it('reports denied-exception rather than a plain deny', () => {
        expect(verdictOf(CONDITION_ERROR_TRACE)).toBe('denied-exception');
    });

    it('carries the message onto the result', () => {
        const result = toAccessResult({
            permitted: false,
            evaluation: {
                parties: ['u1', 'u2'],
                requests: [],
                trace: CONDITION_ERROR_TRACE,
                scenario: '',
            },
        });
        expect(result.verdict).toBe('denied-exception');
        expect(result.message).toBe('Undefined name: testGroup');
    });
});
