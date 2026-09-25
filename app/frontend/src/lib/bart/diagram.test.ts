import { describe, expect, it } from 'vitest';
import {
    assignLanes,
    buildDiagram,
    DiagramStep,
    involvedParties,
    isLaned,
    laneOf,
    lanedParties,
    matchedParties,
    parseCandidateLine,
    parseCycleLine,
    parseRequestLine,
    PartyLabel,
    searchedForParties,
} from './diagram';
import { parseTrace } from './trace';
import {
    CONDITION_ERROR_THEN_MISS_TRACE,
    CONDITION_ERROR_TRACE,
    SECOND_RULE_GRANT_TRACE,
    SEEDED_EXCHANGE_TRACE,
    STUDENTS_AND_TRACE,
    STUDENTS_DENY_TRACE,
    STUDENTS_TRACE,
} from './trace.fixture';

describe('parseRequestLine', () => {
    it('reads an unprefixed request against a concrete party', () => {
        expect(
            parseRequestLine(
                'evaluating Request[requester=2, resource=[(type : exercises)], from=1]',
            ),
        ).toEqual({
            policy: null,
            requester: 2,
            resource: { type: 'exercises' },
            from: { kind: 'index', index: 1 },
        });
    });

    it('reads a policy-prefixed request and records the policy number', () => {
        const line = parseRequestLine(
            'policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]',
        );
        expect(line?.policy).toBe(2);
        expect(line?.from).toEqual({ kind: 'index', index: 2 });
    });

    it('reads a quantified request and keeps the party pattern', () => {
        const line = parseRequestLine(
            'evaluating Request[requester=1, resource=[(type : lectureNotes), (course : ads)], from=any: [(studyLevel : undergraduate), (university : unifi)]]',
        );
        expect(line?.requester).toBe(1);
        expect(line?.resource).toEqual({
            type: 'lectureNotes',
            course: 'ads',
        });
        expect(line?.from).toEqual({
            kind: 'any',
            pattern: { studyLevel: 'undergraduate', university: 'unifi' },
        });
    });

    it('reads an all-quantified request', () => {
        const line = parseRequestLine(
            'evaluating Request[requester=3, resource=[(type : x)], from=all: [(a : b)]]',
        );
        expect(line?.from).toEqual({ kind: 'all', pattern: { a: 'b' } });
    });

    it('returns null for a line that is not a request', () => {
        expect(parseRequestLine('finding matching policies')).toBeNull();
        expect(
            parseRequestLine(
                'rule 2.1: evaluating Exchange[to=ME, resource=[(type : x)], from=REQUESTER]',
            ),
        ).toBeNull();
    });
});

describe('parseCandidateLine', () => {
    it('reads a matching candidate', () => {
        expect(
            parseCandidateLine(
                'policy 2: from match([(university : unifi)], [(username : john), (university : unifi)]) -> true',
            ),
        ).toEqual({
            index: 2,
            pattern: { university: 'unifi' },
            outcome: true,
        });
    });

    it('reads a non-matching candidate', () => {
        const line = parseCandidateLine(
            'policy 5: from match([(a : b)], [(a : c)]) -> false',
        );
        expect(line?.index).toBe(5);
        expect(line?.outcome).toBe(false);
    });

    it('returns null for a resource match, which is a different line', () => {
        expect(
            parseCandidateLine(
                'rule 2.1: resource match([(type : x)], [(type : x)]) -> true',
            ),
        ).toBeNull();
    });
});

describe('parseCycleLine', () => {
    it('reads the vicious-circle break', () => {
        expect(
            parseCycleLine(
                'rule 1.1: compliant request found Request[requester=1, resource=[(type : lectureNotes)], from=2]',
            ),
        ).toEqual({
            policy: null,
            requester: 1,
            resource: { type: 'lectureNotes' },
            from: { kind: 'index', index: 2 },
        });
    });

    it('returns null for an ordinary request line', () => {
        expect(
            parseCycleLine(
                'evaluating Request[requester=1, resource=[(type : x)], from=2]',
            ),
        ).toBeNull();
    });
});

function build(raw: string): DiagramStep[] {
    return buildDiagram(parseTrace(raw));
}

function arrows(raw: string) {
    return build(raw)
        .filter(step => step.kind === 'request')
        .map(step => `${step.from}->${step.to} ${step.outcome}`);
}

function requestLevels(raw: string): number[] {
    return build(raw)
        .filter(step => step.kind === 'request')
        .map(step => step.level);
}

describe('buildDiagram on the denial', () => {
    it('draws one arrow per policy, collapsing the duplicate policy node', () => {
        // `policy 2` appears twice, once per rule attempt. Two arrows would be
        // a request the engine never made.
        expect(arrows(STUDENTS_DENY_TRACE)).toEqual([
            '1->2 false', // david -> john, the fan's first candidate
            '2->1 false', // john -> david, the exchange it demanded
            '1->3 false', // david -> mary, tried after john failed
        ]);
    });

    it('emits the candidate fan before the arrows it resolves to', () => {
        const steps = build(STUDENTS_DENY_TRACE);
        expect(steps[0]).toEqual({
            kind: 'candidates',
            level: 0,
            from: 1,
            quantifier: 'any',
            pattern: {
                studyLevel: 'undergraduate',
                degreeProgram: 'cs',
                university: 'unifi',
            },
            matched: [2, 3],
        });
        expect(steps[1].kind).toBe('request');
    });

    it('nests the demanded exchange one level deeper', () => {
        expect(requestLevels(STUDENTS_DENY_TRACE)).toEqual([0, 1, 0]);
    });

    it('carries the resource pattern on each arrow', () => {
        const [first] = build(STUDENTS_DENY_TRACE).filter(
            step => step.kind === 'request',
        );
        expect(first.resource).toEqual({
            type: 'lectureNotes',
            course: 'programming',
        });
    });
});

describe('buildDiagram on the or-exchange permit', () => {
    it('draws the failed branch and the successful retry', () => {
        expect(arrows(STUDENTS_TRACE)).toEqual([
            '1->2 true',
            '2->1 false',
            '2->1 true',
        ]);
    });

    it('reports only the parties that matched the quantified from', () => {
        const [fan] = build(STUDENTS_TRACE).filter(
            step => step.kind === 'candidates',
        );
        expect(fan.matched).toEqual([2]);
        expect(fan.quantifier).toBe('any');
    });

    it('keeps both OR branches nested inside the policy request', () => {
        // Both sub-requests sit under the same `policy 2` arrow, so neither
        // may read as a fresh top-level request.
        expect(requestLevels(STUDENTS_TRACE)).toEqual([0, 1, 1]);
    });
});

describe('buildDiagram on the and-exchange permit', () => {
    it('draws every sub-request across three parties', () => {
        expect(arrows(STUDENTS_AND_TRACE)).toEqual([
            '1->2 true',
            '2->1 true',
            '2->1 false',
            '2->3 true',
        ]);
    });

    it('reads a candidate run that sits at exchange depth, not under "finding matching policies"', () => {
        const fans = build(STUDENTS_AND_TRACE).filter(
            step => step.kind === 'candidates',
        );
        expect(fans).toHaveLength(3);
        expect(fans[0].matched).toEqual([2, 3]);
        expect(fans[1].from).toBe(2);
        expect(fans[1].matched).toEqual([1, 2, 3]);
    });

    it('marks the vicious-circle break as its own kind, never a permit', () => {
        const cycles = build(STUDENTS_AND_TRACE).filter(
            step => step.kind === 'cycle',
        );
        expect(cycles).toHaveLength(1);
        expect(cycles[0].from).toBe(1);
        expect(cycles[0].to).toBe(2);
        expect(cycles[0].resource).toEqual({ type: 'lectureNotes' });
        // Two arrows deep: the `policy 2` request, then the sub-request whose
        // own exchange is what closes the circle.
        expect(cycles[0].level).toBe(2);
    });

    it('nests all three sub-requests under the policy arrow', () => {
        expect(requestLevels(STUDENTS_AND_TRACE)).toEqual([0, 1, 1, 1]);
    });
});

// A quantified exchange whose party pattern matches nobody: every candidate
// is false and no sub-request follows. The next request line is an
// unrelated evaluation, not this exchange's issuer.
const ZERO_CANDIDATE_EXCHANGE = `evaluating Request[requester=1, resource=[(type : x)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : x)], from=2]
    rule 2.1: resource match([(type : x)], [(type : x)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating Exchange[to=ME, resource=[(type : y)], from=any: [(university : oxford)]]
    policy 1: from match([(university : oxford)], [(username : john)]) -> false
result: false
evaluating Request[requester=3, resource=[(type : z)], from=1]
result: true
`;

describe('buildDiagram on a quantified exchange that matches nobody', () => {
    it('emits no candidate fan it cannot attribute to a party', () => {
        const fans = build(ZERO_CANDIDATE_EXCHANGE).filter(
            step => step.kind === 'candidates',
        );
        expect(fans).toEqual([]);
    });

    it('still draws the unrelated evaluation that follows', () => {
        expect(arrows(ZERO_CANDIDATE_EXCHANGE)).toEqual([
            '1->2 false',
            '3->1 true',
        ]);
    });
});

// A quantified exchange nested inside the policy node the fan is tracking.
// The `(Pol)` clause restates `policy 2: evaluating Request[…]` for its
// second rule, and only `fan` stops that restatement becoming a second arrow.
// Shape derived from `STUDENTS_DENY_TRACE`, with rule 2.1's exchange made
// quantified and rule 2.2 made to succeed.
const NESTED_QUANTIFIED_EXCHANGE = `evaluating Request[requester=1, resource=[(type : lectureNotes)], from=any: [(university : unifi)]]
  finding matching policies
    policy 2: from match([(university : unifi)], [(username : john), (university : unifi)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]
    rule 2.1: resource match([(type : lectureNotes)], [(type : lectureNotes)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating Exchange[to=ME, resource=[(type : exercises)], from=any: [(university : unifi)]]
    policy 1: from match([(university : unifi)], [(username : david), (university : unifi)]) -> true
    evaluating Request[requester=2, resource=[(type : exercises)], from=1]
      policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
        rule 1.1: resource match([(type : exercises)], [(type : lectureNotes)]) -> false
    result: false
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]
    rule 2.2: resource match([(type : lectureNotes)], [(type : lectureNotes)]) -> true
    rule 2.2: condition true -> true
result: true
`;

describe('buildDiagram on a quantified exchange inside a policy node', () => {
    it('still collapses the rule attempts the exchange interrupts', () => {
        // One request was made of party 2, so one arrow is drawn; a second
        // would be a permit the engine never granted.
        expect(arrows(NESTED_QUANTIFIED_EXCHANGE)).toEqual([
            '1->2 true',
            '2->1 false',
        ]);
    });

    it('keeps the fan of the exchange it did open', () => {
        const fans = build(NESTED_QUANTIFIED_EXCHANGE).filter(
            step => step.kind === 'candidates',
        );
        expect(fans.map(fan => fan.matched)).toEqual([[2], [1]]);
    });
});

// The same `(Pol)` re-statement, but with a sub-request under each rule
// attempt, unlike `STUDENTS_DENY_TRACE`'s second attempt.
const MERGED_POLICY_WITH_SECOND_EXCHANGE = `evaluating Request[requester=1, resource=[(type : lectureNotes)], from=any: [(university : unifi)]]
  finding matching policies
    policy 2: from match([(university : unifi)], [(username : john), (university : unifi)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]
    rule 2.1: resource match([(type : lectureNotes)], [(type : lectureNotes)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating Exchange[to=ME, resource=[(type : exercises)], from=REQUESTER]
    evaluating Request[requester=2, resource=[(type : exercises)], from=1]
      policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
        rule 1.1: resource match([(type : exercises)], [(type : lectureNotes)]) -> false
    result: false
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]
    rule 2.2: resource match([(type : lectureNotes)], [(type : lectureNotes)]) -> true
    rule 2.2: condition true -> true
    rule 2.2: evaluating Exchange[to=ME, resource=[(type : notes)], from=REQUESTER]
    evaluating Request[requester=2, resource=[(type : notes)], from=1]
      policy 1: evaluating Request[requester=2, resource=[(type : notes)], from=1]
        rule 1.1: resource match([(type : notes)], [(type : notes)]) -> true
        rule 1.1: condition true -> true
    result: true
result: true
`;

describe('buildDiagram on a merged policy node whose second rule exchanges', () => {
    it('keeps the second attempt nested under the arrow it merged into', () => {
        expect(requestLevels(MERGED_POLICY_WITH_SECOND_EXCHANGE)).toEqual([
            0, 1, 1,
        ]);
    });

    it('draws one arrow to the policy and one sub-request per rule', () => {
        expect(arrows(MERGED_POLICY_WITH_SECOND_EXCHANGE)).toEqual([
            '1->2 true',
            '2->1 false',
            '2->1 true',
        ]);
    });
});

// A quantified `to:`. The engine's `computeIndexes` serves both exchange
// terms and hardcodes the word "from", so a `to:` run is textually
// identical to a `from:` run.
const QUANTIFIED_EXCHANGE_TO = `evaluating Request[requester=1, resource=[(type : lectureNotes)], from=any: [(university : unifi)]]
  finding matching policies
    policy 2: from match([(university : unifi)], [(username : john), (university : unifi)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]
    rule 2.1: resource match([(type : lectureNotes)], [(type : lectureNotes)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating Exchange[to=any: [(role : librarian)], resource=[(type : exercises)], from=REQUESTER]
    policy 3: from match([(role : librarian)], [(username : mary), (role : librarian)]) -> true
    evaluating Request[requester=3, resource=[(type : exercises)], from=1]
      policy 1: evaluating Request[requester=3, resource=[(type : exercises)], from=1]
        rule 1.1: resource match([(type : exercises)], [(type : exercises)]) -> true
        rule 1.1: condition true -> true
    result: true
result: true
`;

describe('buildDiagram on a quantified exchange `to:`', () => {
    it('emits no fan for a run it cannot attribute to a quantifier', () => {
        // Reusing the last quantifier seen would caption party 3 as matching
        // `university: unifi` when it matched `role: librarian`.
        const fans = build(QUANTIFIED_EXCHANGE_TO).filter(
            step => step.kind === 'candidates',
        );
        expect(fans).toHaveLength(1);
        expect(fans[0].pattern).toEqual({ university: 'unifi' });
        expect(fans[0].matched).toEqual([2]);
    });

    it('still draws the request the exchange generated', () => {
        expect(arrows(QUANTIFIED_EXCHANGE_TO)).toEqual([
            '1->2 true',
            '3->1 true',
        ]);
    });
});

// A quantified request whose party pattern matched nobody: `finding matching
// policies` is emitted and no `policy N: from match(…)` candidate follows it.
const NO_CANDIDATE_REQUEST = `evaluating Request[requester=1, resource=[(type : x)], from=any: [(university : oxford)]]
  finding matching policies
result: false
`;

// A concrete (non-quantified) request: the engine never emits `finding
// matching policies` when `from` is already an index, so this trace carries
// no such line at all.
const NO_QUANTIFIED_REQUEST = `evaluating Request[requester=1, resource=[(type : x)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : x)], from=2]
    rule 2.1: resource match([(type : x)], [(type : x)]) -> true
    rule 2.1: condition true -> true
result: true
`;

describe('searchedForParties', () => {
    it('is true when the engine searched and found no candidates', () => {
        expect(searchedForParties(parseTrace(NO_CANDIDATE_REQUEST))).toBe(true);
    });

    it('is true for a trace whose search did turn up candidates', () => {
        expect(searchedForParties(parseTrace(STUDENTS_DENY_TRACE))).toBe(true);
    });

    it('is false for a trace with no quantified request at all', () => {
        expect(searchedForParties(parseTrace(NO_QUANTIFIED_REQUEST))).toBe(
            false,
        );
    });
});

describe('buildDiagram on a quantified request matching nobody', () => {
    it('returns no steps, pairing with searchedForParties', () => {
        expect(build(NO_CANDIDATE_REQUEST)).toEqual([]);
    });
});

describe('buildDiagram degradation', () => {
    it('returns nothing for a trace it cannot read, rather than throwing', () => {
        expect(build('')).toEqual([]);
        expect(build('nonsense\n  more nonsense\n')).toEqual([]);
    });

    it('never derives a verdict: that belongs to the endpoint', () => {
        const kinds = new Set(build(STUDENTS_DENY_TRACE).map(s => s.kind));
        expect(kinds.has('verdict' as never)).toBe(false);
    });
});

function frames(raw: string) {
    return build(raw).filter(
        step =>
            step.kind === 'frame-open' ||
            step.kind === 'frame-close' ||
            step.kind === 'frame-separator',
    );
}

describe('buildDiagram failure causes', () => {
    it('explains a failed request from the lines under it', () => {
        // Two filters, not one `&&`: TS only narrows the element type from a
        // single-discriminant `.filter()`, so splitting keeps `.cause` visible.
        const failed = build(STUDENTS_DENY_TRACE)
            .filter(step => step.kind === 'request')
            .filter(step => step.outcome === false);
        expect(failed[1].cause).toEqual({
            text: 'no rule offers lectureNotes',
            tone: 'deny',
        });
    });

    it('leaves a satisfied request unexplained', () => {
        const permitted = build(STUDENTS_TRACE)
            .filter(step => step.kind === 'request')
            .filter(step => step.outcome === true);
        expect(permitted[0].cause).toBeUndefined();
    });

    it('clears a stale cause when a later rule attempt succeeds', () => {
        // Rule 2.1's resource mismatch fails first, then rule 2.2 succeeds:
        // the merge branch must update `cause` alongside `outcome`, or the
        // arrow renders green with a stale "no rule offers" chip.
        const trace = `evaluating Request[requester=1, resource=[(type : x)], from=any: [(a : b)]]
  finding matching policies
    policy 2: from match([(a : b)], [(a : b)]) -> true
  policy 2: evaluating Request[requester=1, resource=[(type : x)], from=2]
    rule 2.1: resource match([(type : x)], [(type : y)]) -> false
  policy 2: evaluating Request[requester=1, resource=[(type : x)], from=2]
    rule 2.2: resource match([(type : x)], [(type : x)]) -> true
    rule 2.2: condition true -> true
result: true
`;
        const merged = build(trace).filter(step => step.kind === 'request');
        expect(merged).toHaveLength(1);
        expect(merged[0].outcome).toBe(true);
        expect(merged[0].cause).toBeUndefined();
    });
});

describe('buildDiagram granting rule', () => {
    it('names the rule of the attempt that granted a merged arrow', () => {
        // Rule 2.1's barter fails, rule 2.2 grants: the merged arrow must
        // name 2.2 while the drawn frame stays rule 2.1's.
        const [merged] = build(SECOND_RULE_GRANT_TRACE).filter(
            step => step.kind === 'request',
        );
        expect(merged.grantedBy).toBe('2.2');
    });

    it('names the rule of a single-attempt grant', () => {
        const granted = build(STUDENTS_TRACE)
            .filter(step => step.kind === 'request')
            .filter(step => step.outcome === true);
        expect(granted[0].grantedBy).toBe('2.1');
    });

    it('names the granting rule of an exchange sub-request', () => {
        // The OR's lectureNotes leg: john's request granted by rule 1.1.
        const granted = build(STUDENTS_TRACE)
            .filter(step => step.kind === 'request')
            .filter(step => step.outcome === true);
        expect(granted[1].grantedBy).toBe('1.1');
    });

    it('leaves a denied arrow without a granting rule', () => {
        const arrows = build(STUDENTS_DENY_TRACE).filter(
            step => step.kind === 'request',
        );
        expect(arrows.every(step => step.grantedBy === undefined)).toBe(true);
    });
});

describe('buildDiagram frame markers', () => {
    it('opens one composite frame for an OR exchange and closes it on END', () => {
        expect(frames(STUDENTS_TRACE)).toEqual([
            { kind: 'frame-open', policy: 2, operator: 'or', rule: '2.1' },
            { kind: 'frame-separator' },
            { kind: 'frame-close', outcome: true },
        ]);
    });

    it('treats a composite operand as a marker, never a second frame', () => {
        // STUDENTS_TRACE carries two `evaluating Exchange[…]` lines inside
        // the OR: they are its operands, not two separate prices.
        const opens = frames(STUDENTS_TRACE).filter(
            step => step.kind === 'frame-open',
        );
        expect(opens).toHaveLength(1);
    });

    it('opens a single-exchange frame for a rule with no composite', () => {
        // The deny trace's rule 2.1 demands one exchange, so the frame opens on
        // `evaluating Exchange[…]` and closes on the dedent out of policy 2.
        expect(frames(STUDENTS_DENY_TRACE)).toEqual([
            { kind: 'frame-open', policy: 2, operator: 'single', rule: '2.1' },
            { kind: 'frame-close', outcome: false },
        ]);
    });

    it('nests a single frame inside a composite one', () => {
        // AND trace: mary's rule 2.1 is composite; john's rule 1.1 sits inside
        // it with a single exchange of its own.
        expect(frames(STUDENTS_AND_TRACE)).toEqual([
            { kind: 'frame-open', policy: 2, operator: 'and', rule: '2.1' },
            { kind: 'frame-open', policy: 1, operator: 'single', rule: '1.1' },
            { kind: 'frame-close', outcome: true },
            { kind: 'frame-separator' },
            { kind: 'frame-close', outcome: true },
        ]);
    });

    it('leaves the existing request steps untouched', () => {
        expect(arrows(STUDENTS_AND_TRACE)).toEqual([
            '1->2 true',
            '2->1 true',
            '2->1 false',
            '2->3 true',
        ]);
        expect(requestLevels(STUDENTS_AND_TRACE)).toEqual([0, 1, 1, 1]);
    });
});

describe('buildDiagram on the seeded three-party exchange', () => {
    // The third frame-open is not an unrelated rule: it is mary's own AND
    // rule (2.1), evaluated a second time one level deeper, because john's
    // single exchange demands lectureNotes back into mary's policy.
    it('opens mary’s composite frame and john’s single frame inside it', () => {
        const opens = build(SEEDED_EXCHANGE_TRACE).filter(
            step => step.kind === 'frame-open',
        );
        expect(opens.map(step => [step.policy, step.operator])).toEqual([
            [2, 'and'],
            [3, 'single'],
            [2, 'and'],
        ]);
    });

    it('balances every frame it opens', () => {
        const markers = build(SEEDED_EXCHANGE_TRACE).filter(
            step => step.kind === 'frame-open' || step.kind === 'frame-close',
        );
        let depth = 0;
        for (const marker of markers) {
            depth += marker.kind === 'frame-open' ? 1 : -1;
            expect(depth).toBeGreaterThanOrEqual(0);
        }
        expect(depth).toBe(0);
    });

    it('still shows the cycle break, three levels deep', () => {
        // Mary's re-entered AND rule closes on the vicious-circle break
        // rather than recursing forever, same shape as STUDENTS_AND_TRACE
        // at depth 1, here at depth 3.
        const cycles = build(SEEDED_EXCHANGE_TRACE).filter(
            step => step.kind === 'cycle',
        );
        expect(cycles).toEqual([
            {
                kind: 'cycle',
                level: 3,
                from: 2,
                to: 3,
                resource: { type: 'lectureNotes' },
            },
        ]);
    });
});

// A rule that matched and then failed to pay its price. The outer arrow's
// evidence stops at the `evaluating Request[…]` line the exchange
// generated: whatever refused there is that arrow's own business.
const NESTED_CONDITION_FAILURE = `evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : lectureNotes)], from=2]
    rule 2.1: resource match([(type : lectureNotes)], [(type : lectureNotes)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: evaluating Exchange[to=ME, resource=[(type : exercises)], from=REQUESTER]
    evaluating Request[requester=2, resource=[(type : exercises)], from=1]
      policy 1: evaluating Request[requester=2, resource=[(type : exercises)], from=1]
        rule 1.2: resource match([(type : exercises)], [(type : exercises)]) -> true
        rule 1.2: condition requester.username in friends -> false
    result: false
result: false
`;

// A rule whose exchange demands nothing of anybody: the `to` pattern matched
// no party, so the engine permits vacuously, a grant given for free rather
// than earned.
const VACUOUS_PERMIT = `evaluating Request[requester=1, resource=[(type : exercises)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : exercises)], from=2]
    rule 2.1: resource match([(type : exercises)], [(type : exercises)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: satisfied: no one to exchange
result: true
`;

// The same vacuous line, but with no sibling `result:` at all. `outcome:
// null` must stay chipless: the row draws no mark there on purpose.
const VACUOUS_PERMIT_NO_RESULT = `evaluating Request[requester=1, resource=[(type : exercises)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(type : exercises)], from=2]
    rule 2.1: resource match([(type : exercises)], [(type : exercises)]) -> true
    rule 2.1: condition true -> true
    rule 2.1: satisfied: no one to exchange
`;

describe('buildDiagram causes across a whole policy', () => {
    it('does not claim no rule offers the resource when an earlier attempt matched it', () => {
        // Rule 2.1 DID offer lectureNotes · programming: it demanded a price
        // that could not be paid, so blaming the resource would contradict
        // the "grants only in exchange" frame beneath the same arrow.
        const [merged] = build(STUDENTS_DENY_TRACE).filter(
            step => step.kind === 'request',
        );
        expect(merged.outcome).toBe(false);
        expect(merged.cause?.text ?? '').not.toMatch(/^no rule offers/);
        // No single line explains this refusal, so the honest chip is none at
        // all and the row falls back to a bare ✗.
        expect(merged.cause).toBeUndefined();
    });

    it('never borrows a nested sub-request’s evidence to explain an arrow', () => {
        const [outer, inner] = build(NESTED_CONDITION_FAILURE).filter(
            step => step.kind === 'request',
        );
        expect(`${outer.from}->${outer.to}`).toBe('1->2');
        expect(outer.cause).toBeUndefined();
        // The condition belongs to party 1's rule, and the arrow it explains
        // is the one below.
        expect(`${inner.from}->${inner.to}`).toBe('2->1');
        expect(inner.cause).toEqual({
            text: 'condition false · requester.username in friends',
            tone: 'deny',
        });
    });
});

describe('buildDiagram on a vacuous permit', () => {
    it('warns on a satisfied arrow that was granted for free', () => {
        const [step] = build(VACUOUS_PERMIT).filter(
            item => item.kind === 'request',
        );
        expect(step.outcome).toBe(true);
        expect(step.cause).toEqual({
            text: 'nobody to exchange with',
            tone: 'warn',
        });
    });

    it('still says nothing when the trace stated no outcome', () => {
        const [step] = build(VACUOUS_PERMIT_NO_RESULT).filter(
            item => item.kind === 'request',
        );
        expect(step.outcome).toBeNull();
        expect(step.cause).toBeUndefined();
    });
});

describe('buildDiagram, swallowed condition exceptions', () => {
    /** The single point-to-point arrow a one-policy trace produces. */
    const arrowOf = (trace: string) => {
        const step = buildDiagram(parseTrace(trace)).find(
            candidate => candidate.kind === 'request',
        );
        expect(step?.kind).toBe('request');
        return step as Extract<DiagramStep, { kind: 'request' }>;
    };

    it('refuses the arrow when the erroring rule is the last attempt', () => {
        // The erroring line states no boolean, so the last boolean in the
        // policy's subtree is the same rule's own `resource match -> true`,
        // which would otherwise read as a satisfied, chipless arrow.
        const arrow = arrowOf(CONDITION_ERROR_TRACE);
        expect(arrow.outcome).toBe(false);
        expect(arrow.cause).toEqual({
            text: 'condition errored · Undefined name: testGroup',
            tone: 'deny',
        });
    });

    it('still refuses it when a later rule attempt misses the resource', () => {
        // Rule 2.4 supplies a boolean, so this shape stays correct.
        const arrow = arrowOf(CONDITION_ERROR_THEN_MISS_TRACE);
        expect(arrow.outcome).toBe(false);
        expect(arrow.cause).toEqual({
            text: 'condition errored · Undefined name: testGroup',
            tone: 'deny',
        });
    });

    it('leaves a green arrow alone when a later rule permits', () => {
        // An errored branch the policy went on to grant past: the arrow is
        // green and carries no chip, since `causeFor` gates deny-toned
        // causes on a refusal.
        const PERMITTED_AFTER_ERROR = `evaluating Request[requester=1, resource=[(test : 1)], from=2]
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.1: resource match([(test : 1)], [(test : 1)]) -> true
    rule 2.1: condition testGroup in requester.groups -> Undefined name: testGroup
  policy 2: evaluating Request[requester=1, resource=[(test : 1)], from=2]
    rule 2.2: resource match([(test : 1)], [(test : 1)]) -> true
    rule 2.2: condition true -> true
result: true
`;
        const arrow = arrowOf(PERMITTED_AFTER_ERROR);
        expect(arrow.outcome).toBe(true);
        expect(arrow.cause).toBeUndefined();
    });
});

function involvedList(steps: DiagramStep[]): number[] {
    return [...involvedParties(steps)].sort((a, b) => a - b);
}

describe('involvedParties', () => {
    it('reports nobody for an empty diagram', () => {
        expect(involvedParties([])).toEqual(new Set());
    });

    it('reports only the two parties the or-exchange permit touches', () => {
        // The third party is loaded because a policy quantifies over a
        // pattern it matches, not because this evaluation goes near it.
        expect(involvedList(build(STUDENTS_TRACE))).toEqual([1, 2]);
    });

    it('reports all three parties the and-exchange permit touches', () => {
        expect(involvedList(build(STUDENTS_AND_TRACE))).toEqual([1, 2, 3]);
    });

    it('reports all three parties the denial touches', () => {
        expect(involvedList(build(STUDENTS_DENY_TRACE))).toEqual([1, 2, 3]);
    });

    it('reports both parties of a condition error', () => {
        expect(involvedList(build(CONDITION_ERROR_TRACE))).toEqual([1, 2]);
    });

    it('drops a party that only ever matched a candidate fan', () => {
        // Party 3 matched the pattern and no arrow ever reached it, so it
        // takes no column; `matchedParties` is what still accounts for it.
        const steps: DiagramStep[] = [
            {
                kind: 'candidates',
                level: 0,
                from: 1,
                quantifier: 'any',
                pattern: { studyLevel: 'undergraduate' },
                matched: [2, 3],
            },
            {
                kind: 'request',
                level: 0,
                from: 1,
                to: 2,
                resource: { type: 'lectureNotes' },
                outcome: true,
            },
        ];
        expect(involvedList(steps)).toEqual([1, 2]);
    });

    it('keeps the searching party of a fan that reached nobody', () => {
        // The filled origin dot lands on its lane whatever the fan found.
        const steps: DiagramStep[] = [
            {
                kind: 'candidates',
                level: 0,
                from: 4,
                quantifier: 'all',
                pattern: { university: 'unifi' },
                matched: [],
            },
        ];
        expect(involvedList(steps)).toEqual([4]);
    });

    it('keeps the party a frame names in its caption', () => {
        // `DiagramFrame` renders "<party> grants only in exchange", so the
        // granting party must be resolvable even off any lane.
        const steps: DiagramStep[] = [
            { kind: 'frame-open', policy: 4, operator: 'single', rule: '4.1' },
        ];
        expect(involvedList(steps)).toEqual([4]);
    });

    it('ignores frame markers that name no party', () => {
        const steps: DiagramStep[] = [
            { kind: 'frame-separator' },
            { kind: 'frame-close', outcome: true },
        ];
        expect(involvedParties(steps)).toEqual(new Set());
    });
});

const LABELS: PartyLabel[] = [
    { index: 1, id: 'mary-id', label: 'mary' },
    { index: 2, id: 'david-id', label: 'david' },
    { index: 3, id: 'john-id', label: 'john' },
];

describe('assignLanes', () => {
    it('numbers involved parties consecutively and nulls the rest', () => {
        // John is loaded by the closure but never asked, so david moves up
        // into lane 2 while keeping party number 2.
        expect(assignLanes(LABELS, new Set([1, 2]))).toEqual([
            { index: 1, id: 'mary-id', label: 'mary', lane: 1 },
            { index: 2, id: 'david-id', label: 'david', lane: 2 },
            { index: 3, id: 'john-id', label: 'john', lane: null },
        ]);
    });

    it('closes the gap left by a hidden party in the middle', () => {
        expect(
            assignLanes(LABELS, new Set([1, 3])).map(party => party.lane),
        ).toEqual([1, null, 2]);
    });

    it('leaves lane equal to index when nothing is hidden', () => {
        for (const party of assignLanes(LABELS, new Set([1, 2, 3])))
            expect(party.lane).toBe(party.index);
    });

    it('nulls every lane when the diagram drew nothing', () => {
        expect(assignLanes(LABELS, new Set()).map(p => p.lane)).toEqual([
            null,
            null,
            null,
        ]);
    });

    it('preserves party order', () => {
        expect(assignLanes(LABELS, new Set([2])).map(p => p.id)).toEqual([
            'mary-id',
            'david-id',
            'john-id',
        ]);
    });
});

describe('lanedParties', () => {
    it('keeps only the parties that get a lane, in lane order', () => {
        const assigned = assignLanes(LABELS, new Set([1, 3]));
        expect(lanedParties(assigned).map(party => party.label)).toEqual([
            'mary',
            'john',
        ]);
    });

    it('is empty when nothing was drawn', () => {
        expect(lanedParties(assignLanes(LABELS, new Set()))).toEqual([]);
    });
});

describe('laneOf', () => {
    it('returns the lane of a party the diagram drew', () => {
        // David is hidden, so john keeps party number 3 while sitting in lane
        // 2: an implementation that ignores `lane` and echoes the index back
        // would also pass a fixture where the two happen to be equal.
        const parties = assignLanes(LABELS, new Set([1, 3]));
        expect(laneOf(parties, 3)).toBe(2);
    });

    it('falls back to the raw index for a party present but never laned', () => {
        // Mary's request never reached john, so john's `lane` is `null`; the
        // fallback still returns *something* rather than `undefined`.
        const parties = assignLanes(LABELS, new Set([1, 2]));
        expect(parties[2].lane).toBeNull();
        expect(laneOf(parties, 3)).toBe(3);
    });

    it('falls back to the raw index for an index no party carries at all', () => {
        const parties = assignLanes(LABELS, new Set([1, 2]));
        expect(laneOf(parties, 99)).toBe(99);
    });
});

describe('isLaned', () => {
    it('is true for a party the diagram drew', () => {
        expect(isLaned(assignLanes(LABELS, new Set([1, 3])), 3)).toBe(true);
    });

    it('is false for a party present but never laned', () => {
        // `laneOf` cannot answer this: it echoes the raw index back.
        expect(isLaned(assignLanes(LABELS, new Set([1, 3])), 2)).toBe(false);
    });

    it('is false for an index no party carries at all', () => {
        expect(isLaned(assignLanes(LABELS, new Set([1])), 99)).toBe(false);
    });
});

describe('matchedParties', () => {
    it('reports nobody for an empty diagram', () => {
        expect(matchedParties([])).toEqual(new Set());
    });

    it('collects the matches of every fan', () => {
        const steps: DiagramStep[] = [
            {
                kind: 'candidates',
                level: 0,
                from: 1,
                quantifier: 'any',
                pattern: {},
                matched: [2, 3],
            },
            {
                kind: 'candidates',
                level: 1,
                from: 2,
                quantifier: 'all',
                pattern: {},
                matched: [3, 4],
            },
        ];
        expect(matchedParties(steps)).toEqual(new Set([2, 3, 4]));
    });

    it('ignores a party only an arrow touches', () => {
        const steps: DiagramStep[] = [
            {
                kind: 'request',
                level: 0,
                from: 1,
                to: 2,
                resource: { type: 'notes' },
                outcome: true,
            },
        ];
        expect(matchedParties(steps)).toEqual(new Set());
    });
});
