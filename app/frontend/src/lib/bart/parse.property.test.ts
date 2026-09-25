import { describe, expect, it } from 'vitest';
import { parseRule } from './parse';
import { ExchangeTerm, Participant, printRule, RuleAst } from './rule';
import { BartAttrs } from './types';

/**
 * Every attribute-value shape the editor can author, plus the two the grammar
 * allows that `AttrKind` has no name for (an empty collection, a negative
 * number). One key per shape, so a single pattern exercises them all.
 */
const VALUES: BartAttrs[] = [
    { k: 'text' },
    { k: 'with "quotes" and \\ backslash' },
    { k: 42 },
    { k: -1.5 },
    { k: true },
    { k: false },
    { k: ['a', 'b'] },
    { k: ['only'] },
    { k: [] },
    { k: [1, 2, 3] },
    { k: [true, false] },
    { a: 'x', b: 2, c: false, d: ['p', 'q'] },
];

const TO: Participant[] = [
    { kind: 'me' },
    { kind: 'any', attrs: {} },
    { kind: 'any', attrs: { university: 'unifi' } },
    { kind: 'all', attrs: { degreeProgram: 'cs', year: 2 } },
];

const FROM: Participant[] = [
    { kind: 'requester' },
    { kind: 'all', attrs: {} },
    { kind: 'any', attrs: { company: 'RabbitService' } },
];

const CONDITIONS: (string | undefined)[] = [
    undefined,
    'a = 1',
    'requester.username in friends',
    'not(requester.company = "R")',
    '(a) and (b)',
    'a = "x, y"',
    'date_year > 2025 and date_month <= 6',
];

function term(i: number): ExchangeTerm {
    return {
        to: TO[i % TO.length],
        resource: { slot: i },
        from: FROM[i % FROM.length],
    };
}

/** Every AST in the bounded space, as [label, ast] pairs for `it.each`. */
function cases(): [string, RuleAst][] {
    const out: [string, RuleAst][] = [];
    let n = 0;

    for (const resource of VALUES)
        for (const condition of CONDITIONS)
            for (const termCount of [0, 1, 2, 3])
                for (const connector of ['and', 'or'] as const) {
                    // The one-term-implies-`and` invariant: a lone term on `or`
                    // is not a legal ExchangeGroup, so it is not generated.
                    if (termCount === 1 && connector === 'or') continue;
                    const ast: RuleAst = { resource };
                    if (condition !== undefined) ast.condition = condition;
                    if (termCount > 0)
                        ast.exchange = {
                            connector,
                            terms: Array.from({ length: termCount }, (_, i) =>
                                term(i),
                            ),
                        };
                    out.push([`case ${n++}`, ast]);
                }

    return out;
}

describe('printRule / parseRule round trip', () => {
    const all = cases();

    it('covers a meaningful space', () => {
        // 12 patterns x 7 conditions x 7 (termCount, connector) combinations.
        expect(all.length).toBe(588);
    });

    it.each(all)('%s round-trips at the default width', (_label, ast) => {
        const result = parseRule(printRule(ast));
        if (!result.ok)
            throw new Error(
                `${printRule(ast)} failed to parse back: ${result.reason}`,
            );
        expect(result.ast).toEqual(ast);
    });

    it.each(all)('%s round-trips when forced onto one line', (_label, ast) => {
        const result = parseRule(printRule(ast, 10_000));
        if (!result.ok)
            throw new Error(`failed to parse back: ${result.reason}`);
        expect(result.ast).toEqual(ast);
    });

    it.each(all)('%s round-trips when forced to break', (_label, ast) => {
        const result = parseRule(printRule(ast, 0));
        if (!result.ok)
            throw new Error(`failed to parse back: ${result.reason}`);
        expect(result.ast).toEqual(ast);
    });

    it('printing is idempotent', () => {
        for (const [, ast] of all) {
            const once = printRule(ast);
            const result = parseRule(once);
            if (!result.ok) throw new Error(result.reason);
            expect(printRule(result.ast)).toBe(once);
        }
    });
});
