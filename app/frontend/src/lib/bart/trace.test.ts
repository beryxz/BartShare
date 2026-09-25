import { describe, expect, it } from 'vitest';
import { flattenTrace, parseTrace, traceVerdict } from './trace';
import {
    CONDITION_ERROR_TRACE,
    STUDENTS_AND_TRACE,
    STUDENTS_DENY_TRACE,
    STUDENTS_TRACE,
} from './trace.fixture';

describe('parseTrace', () => {
    it('returns one root for a trace with a single top-level evaluation', () => {
        const roots = parseTrace(STUDENTS_TRACE);
        expect(roots).toHaveLength(2);
        expect(roots[0].kind).toBe('request');
        expect(roots[1].kind).toBe('result');
        expect(roots[1].outcome).toBe(true);
    });

    it('nests by two-space indentation', () => {
        const [root] = parseTrace(STUDENTS_TRACE);
        expect(root.depth).toBe(0);
        const kinds = root.children.map(c => c.kind);
        expect(kinds).toContain('other');
        expect(kinds).toContain('policy');
        expect(root.children.every(c => c.depth === 1)).toBe(true);
    });

    it('classifies line kinds', () => {
        const flat: string[] = [];
        const walk = (n: ReturnType<typeof parseTrace>[number]) => {
            flat.push(n.kind);
            n.children.forEach(walk);
        };
        parseTrace(STUDENTS_TRACE).forEach(walk);
        expect(flat).toContain('request');
        expect(flat).toContain('policy');
        expect(flat).toContain('rule');
        expect(flat).toContain('connector');
        expect(flat).toContain('result');
    });

    it('extracts the -> true/false outcome, and null when absent', () => {
        const roots = parseTrace(STUDENTS_TRACE);
        const policy = roots[0].children.find(c => c.kind === 'policy');
        expect(policy?.outcome).toBeNull();

        const ruleLines: boolean[] = [];
        const walk = (n: ReturnType<typeof parseTrace>[number]) => {
            if (n.text.startsWith('rule 1.2: condition'))
                ruleLines.push(n.outcome as boolean);
            n.children.forEach(walk);
        };
        roots.forEach(walk);
        expect(ruleLines).toEqual([false]);
    });

    it('assigns stable unique ids so React keys are safe', () => {
        const ids: string[] = [];
        const walk = (n: ReturnType<typeof parseTrace>[number]) => {
            ids.push(n.id);
            n.children.forEach(walk);
        };
        parseTrace(STUDENTS_TRACE).forEach(walk);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('ignores blank lines and tolerates an empty trace', () => {
        expect(parseTrace('')).toEqual([]);
        expect(parseTrace('\n\n')).toEqual([]);
    });

    it('does not lose lines that dedent by more than one level', () => {
        const raw = ['a', '    b', '  c'].join('\n');
        const roots = parseTrace(raw);
        expect(roots).toHaveLength(1);
        expect(roots[0].children.map(n => n.text)).toEqual(['b', 'c']);
    });
});

describe('parseTrace on the AND / three-party trace', () => {
    it('classifies the cycle break as its own kind', () => {
        const compliance = flattenTrace(parseTrace(STUDENTS_AND_TRACE)).filter(
            n => n.kind === 'compliance',
        );
        expect(compliance).toHaveLength(1);
        expect(compliance[0].text).toContain('compliant request found');
        // It is not an outcome line, so it must not claim one.
        expect(compliance[0].outcome).toBeNull();
    });

    it('reads the AND connector as a connector, not an exchange', () => {
        const connectors = flattenTrace(parseTrace(STUDENTS_AND_TRACE)).filter(
            n => n.kind === 'connector',
        );
        expect(connectors.map(n => n.text)).toEqual(['rule 2.1: AND']);
    });

    it('keeps sibling result nodes distinct when any tries several parties', () => {
        // Inside the second AND branch the engine tries party 1 (false) then
        // party 3 (true). Collapsing these would misreport the evaluation.
        const results = flattenTrace(parseTrace(STUDENTS_AND_TRACE))
            .filter(n => n.kind === 'result')
            .map(n => n.outcome);
        expect(results).toEqual([true, false, true, true]);
    });

    it('handles policy from-match lines at exchange depth', () => {
        const policies = flattenTrace(parseTrace(STUDENTS_AND_TRACE)).filter(
            n => n.kind === 'policy' && n.text.includes('from match'),
        );
        // 2 under "finding matching policies" + 3 per AND branch.
        expect(policies).toHaveLength(8);
        expect(policies.every(n => n.outcome === true)).toBe(true);
    });

    it('still resolves the overall verdict', () => {
        expect(traceVerdict(STUDENTS_AND_TRACE)).toBe(true);
    });
});

describe('flattenTrace', () => {
    it('returns every node in document order', () => {
        const flat = flattenTrace(parseTrace(STUDENTS_DENY_TRACE));
        expect(flat).toHaveLength(17);
        expect(flat[0].text).toMatch(/^evaluating Request\[requester=1/);
        expect(flat[1].text).toBe('finding matching policies');
        expect(flat.at(-1)?.text).toBe('result: false');
    });

    it('emits a parent immediately before its own children', () => {
        const flat = flattenTrace(parseTrace(STUDENTS_TRACE));
        for (let i = 0; i < flat.length - 1; i++)
            expect(flat[i + 1].depth).toBeLessThanOrEqual(flat[i].depth + 1);
    });

    it('preserves each node depth', () => {
        const flat = flattenTrace(parseTrace(STUDENTS_DENY_TRACE));
        expect(flat.map(n => n.depth)).toEqual([
            0, 1, 2, 2, 1, 2, 2, 2, 2, 3, 4, 2, 1, 2, 1, 2, 0,
        ]);
    });

    it('survives a depth jump of more than one level', () => {
        const roots = parseTrace('a\n      b\n  c\n');
        expect(flattenTrace(roots).map(n => n.text)).toEqual(['a', 'b', 'c']);
    });
});

describe('traceVerdict', () => {
    it('reads the final top-level result', () => {
        expect(traceVerdict(STUDENTS_TRACE)).toBe(true);
    });

    it('ignores nested result lines and reads only the top level', () => {
        // STUDENTS_AND_TRACE contains a nested `result: false`; the verdict is
        // the root-level line, and confusing the two would report a deny.
        expect(traceVerdict(STUDENTS_AND_TRACE)).toBe(true);
    });

    it('returns null when no top-level result line exists', () => {
        expect(traceVerdict('evaluating Request[...]\n')).toBeNull();
    });
});

describe('outcome classification', () => {
    /** The condition line of `CONDITION_ERROR_TRACE`'s rule 2.3. */
    const erroringCondition = () =>
        flattenTrace(parseTrace(CONDITION_ERROR_TRACE)).find(node =>
            node.text.startsWith('rule 2.3: condition'),
        );

    it('reads a swallowed condition exception as an errored outcome', () => {
        expect(erroringCondition()?.outcome).toEqual({
            errored: 'Undefined name: testGroup',
        });
    });

    it('still reads an ordinary boolean condition outcome', () => {
        const [node] = parseTrace('rule 1.1: condition true -> true');
        expect(node.outcome).toBe(true);
        const [refused] = parseTrace(
            'rule 1.2: condition requester.username in friends -> false',
        );
        expect(refused.outcome).toBe(false);
    });

    it('never reads an exception out of a non-condition line', () => {
        // Only a condition line ever formats a caught exception into an
        // outcome position; a `resource match`/`from match` line cannot.
        const [node] = parseTrace(
            'rule 2.1: resource match([(a : b)], [(a : c)]) -> false',
        );
        expect(node.outcome).toBe(false);
        const [other] = parseTrace('finding matching policies');
        expect(other.outcome).toBeNull();
    });

    it('splits at the outcome arrow when a string literal holds one', () => {
        const [node] = parseTrace(
            'rule 1.1: condition name == "a -> b" -> Undefined name: name',
        );
        expect(node.outcome).toEqual({ errored: 'Undefined name: name' });
    });

    it('keeps traceVerdict reading booleans only', () => {
        expect(traceVerdict(CONDITION_ERROR_TRACE)).toBe(false);
    });

    it('classifies an empty/whitespace outcome as errored, not null', () => {
        // A bare `->` with no trailing space, post-`.trim()`, must still read
        // as errored: `null` here is indistinguishable from "not recognised",
        // which would render a denied-by-exception rule as if nothing happened.
        const [bare] = parseTrace('rule 2.3: condition foo ->');
        expect(bare.outcome).toEqual({
            errored: 'the exception carried no message',
        });

        const [whitespace] = parseTrace('rule 2.3: condition foo ->   ');
        expect(whitespace.outcome).toEqual({
            errored: 'the exception carried no message',
        });
    });

    it('reads a literal "null" message as no message, not the word "null"', () => {
        // `e.getMessage()` returns Java `null` for many exceptions; showing
        // that verbatim ("condition errored · null") is a developer leak.
        const [node] = parseTrace('rule 2.3: condition foo -> null');
        expect(node.outcome).toEqual({
            errored: 'the exception carried no message',
        });
    });
});
