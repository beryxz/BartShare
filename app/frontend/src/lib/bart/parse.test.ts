import { describe, expect, it } from 'vitest';
import {
    isSyntaxReason,
    MIXED_EXCHANGE_REASON,
    NOT_REPRESENTABLE_REASON,
    parseRule,
    parseSyntax,
    toBlocks,
    toPolicyRule,
} from './parse';
import { printRule, printTree, RuleAst } from './rule';

/** Unwraps a parse expected to succeed. */
function ast(source: string): RuleAst {
    const result = parseRule(source);
    if (!result.ok) throw new Error(`expected a parse, got: ${result.reason}`);
    return result.ast;
}

/** Unwraps a parse expected to fail. */
function failure(source: string): { reason: string; line?: number } {
    const result = parseRule(source);
    if (result.ok) throw new Error('expected a failure');
    return { reason: result.reason, line: result.at?.line };
}

describe('parseRule: resource pattern', () => {
    it('reads a single attribute', () => {
        expect(ast('(resource:(type:"notes"))')).toEqual({
            resource: { type: 'notes' },
        });
    });

    it('reads several attributes in source order', () => {
        expect(ast('(resource:(type:"n")(course:"ads"))').resource).toEqual({
            type: 'n',
            course: 'ads',
        });
    });

    it('tolerates the spacing the paper fixtures use', () => {
        expect(ast('( resource : ( type : "notes" ) )')).toEqual({
            resource: { type: 'notes' },
        });
    });

    it('ignores comments', () => {
        expect(ast('# a rule\n(resource:(type:"notes")) # trailing')).toEqual({
            resource: { type: 'notes' },
        });
    });

    it('rejects an empty resource pattern, which the grammar requires', () => {
        expect(failure('(resource:)').reason).toMatch(/line 1:/i);
    });

    it('rejects a duplicate attribute key', () => {
        expect(failure('(resource:(a:1)(a:2))').reason).toMatch(/duplicate/i);
    });
});

describe('parseRule: values', () => {
    it('reads a scalar string, unescaping it', () => {
        expect(ast('(resource:(k:"a\\"b"))').resource).toEqual({ k: 'a"b' });
    });

    it('reads integers, decimals and negatives', () => {
        expect(ast('(resource:(a:1)(b:2.5)(c:-3))').resource).toEqual({
            a: 1,
            b: 2.5,
            c: -3,
        });
    });

    it.each(['1', '2.5', '-3', '-4.25', '0'])(
        'round-trips the number literal %s exactly',
        text => {
            expect(ast(`(resource:(k:${text}))`).resource).toEqual({
                k: Number(text),
            });
        },
    );

    it.each(['1.0', '300.0', '9007199254740993', '-0'])(
        'reports the number literal %s as unrepresentable, not a syntax error',
        text => {
            const result = parseRule(`(resource:(k:${text}))`);
            if (result.ok) throw new Error('expected a failure');
            expect(result.reason).toBe(NOT_REPRESENTABLE_REASON);
            expect(result.at).toBeUndefined();
        },
    );

    it('reads booleans', () => {
        expect(ast('(resource:(k:true)(j:false))').resource).toEqual({
            k: true,
            j: false,
        });
    });

    it('reads a bare comma list as a collection', () => {
        expect(ast('(resource:(k:"a","b"))').resource).toEqual({
            k: ['a', 'b'],
        });
    });

    it('reads a braced list as a collection, including one element', () => {
        expect(ast('(resource:(k:{"a"}))').resource).toEqual({ k: ['a'] });
    });

    it('reads an empty braced list as an empty collection', () => {
        expect(ast('(resource:(k:{}))').resource).toEqual({ k: [] });
    });

    it('keeps a scalar and a one-element collection distinct', () => {
        expect(ast('(resource:(k:"a"))').resource.k).toBe('a');
        expect(ast('(resource:(k:{"a"}))').resource.k).toEqual(['a']);
    });
});

describe('parseRule: condition', () => {
    it('reads a parenthesised condition, stripping the outer parens once', () => {
        expect(ast('(resource:(t:"n"), condition:(a = 1))').condition).toBe(
            'a = 1',
        );
    });

    it('reads a bare condition, as courier_ex3.bart writes it', () => {
        expect(
            ast('(resource:(t:"n"), condition:requester.company = "R")')
                .condition,
        ).toBe('requester.company = "R"');
    });

    it('keeps inner parens that do not wrap the whole condition', () => {
        expect(ast('(resource:(t:"n"), condition:(a) and (b))').condition).toBe(
            '(a) and (b)',
        );
    });

    it('strips only one layer', () => {
        expect(ast('(resource:(t:"n"), condition:((a = 1)))').condition).toBe(
            '(a = 1)',
        );
    });

    it('reads not(...) without mistaking its parens for the wrapper', () => {
        expect(ast('(resource:(t:"n"), condition:not(a = 1))').condition).toBe(
            'not(a = 1)',
        );
    });

    it('does not stop at a comma inside a string', () => {
        expect(
            ast('(resource:(t:"n"), condition:(a = "x, y"))').condition,
        ).toBe('a = "x, y"');
    });

    it('stops at the comma before the exchange clause', () => {
        const parsed = ast(
            '(resource:(t:"n"), condition:(a = 1), exchange:(to:me, resource:(t:"x"), from:requester))',
        );
        expect(parsed.condition).toBe('a = 1');
        expect(parsed.exchange?.terms).toHaveLength(1);
    });

    it('rejects an empty condition', () => {
        expect(failure('(resource:(t:"n"), condition:)').reason).toMatch(
            /condition/i,
        );
    });
});

describe('parseRule: clause cardinality and order', () => {
    // A repeat must be a syntax error, not last-wins: printRule would emit
    // only the surviving clause, silently dropping the rest.
    it('rejects a repeated condition instead of keeping the last one', () => {
        const twice =
            '(resource:(t:"n"), condition:(a = 1), condition:(b = 2))';
        expect(failure(twice).reason).toMatch(/repeated 'condition'/i);
    });

    it('rejects a repeated exchange', () => {
        const twice =
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester), exchange:(to:me, resource:(t:"b"), from:requester))';
        expect(failure(twice).reason).toMatch(/repeated 'exchange'/i);
    });

    it('rejects a condition after an exchange, which the grammar orders', () => {
        const swapped =
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester), condition:(a = 1))';
        expect(failure(swapped).reason).toMatch(/must come before/i);
    });

    it('reports a repeat as a positioned syntax error, so it is squiggled', () => {
        const twice =
            '(resource:(t:"n"), condition:(a = 1), condition:(b = 2))';
        const result = parseRule(twice);
        if (result.ok) throw new Error('expected a failure');
        // A position is what tells `markersFor` this is an error rather than
        // valid Bart the block editor merely cannot show.
        expect(result.at).toBeDefined();
        expect(result.reason).toMatch(/^Line 1:/);
    });

    it('still accepts each clause once, in grammar order', () => {
        const both =
            '(resource:(t:"n"), condition:(a = 1), exchange:(to:me, resource:(t:"x"), from:requester))';
        const parsed = ast(both);
        expect(parsed.condition).toBe('a = 1');
        expect(parsed.exchange?.terms).toHaveLength(1);
    });
});

describe('parseRule: exchange', () => {
    const single =
        '(resource:(t:"n"), exchange:(to:me, resource:(t:"x"), from:requester))';

    it('reads a single term and normalises its connector to and', () => {
        expect(ast(single).exchange).toEqual({
            connector: 'and',
            terms: [
                {
                    to: { kind: 'me' },
                    resource: { t: 'x' },
                    from: { kind: 'requester' },
                },
            ],
        });
    });

    it('reads a quantified from with its pattern', () => {
        const parsed = ast(
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"x"), from:(any:(u:"unifi"))))',
        );
        expect(parsed.exchange?.terms[0].from).toEqual({
            kind: 'any',
            attrs: { u: 'unifi' },
        });
    });

    it('reads an empty quantified pattern', () => {
        const parsed = ast(
            '(resource:(t:"n"), exchange:(to:(all:), resource:(t:"x"), from:requester))',
        );
        expect(parsed.exchange?.terms[0].to).toEqual({
            kind: 'all',
            attrs: {},
        });
    });

    it('flattens a homogeneous chain of any depth', () => {
        const source =
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) and (to:me, resource:(t:"c"), from:requester))';
        const group = ast(source).exchange!;
        expect(group.connector).toBe('and');
        expect(group.terms.map(t => t.resource.t)).toEqual(['a', 'b', 'c']);
    });

    it('flattens an explicitly left-nested chain identically', () => {
        const nested =
            '(resource:(t:"n"), exchange:((to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester)) and (to:me, resource:(t:"c"), from:requester))';
        expect(ast(nested).exchange!.terms.map(t => t.resource.t)).toEqual([
            'a',
            'b',
            'c',
        ]);
    });

    it('reports a mixed and/or exchange as unrepresentable, not as a syntax error', () => {
        const mixed =
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) or (to:me, resource:(t:"c"), from:requester))';
        expect(failure(mixed).reason).toBe(MIXED_EXCHANGE_REASON);
    });

    it('rejects to:requester, which the grammar does not allow', () => {
        expect(
            failure(
                '(resource:(t:"n"), exchange:(to:requester, resource:(t:"x"), from:requester))',
            ).reason,
        ).toMatch(/line 1:/i);
    });

    it('rejects from:me, which the grammar does not allow', () => {
        expect(
            failure(
                '(resource:(t:"n"), exchange:(to:me, resource:(t:"x"), from:me))',
            ).reason,
        ).toMatch(/line 1:/i);
    });

    it('rejects an exchange term with an empty resource pattern', () => {
        expect(
            failure(
                '(resource:(t:"n"), exchange:(to:me, resource:, from:requester))',
            ).reason,
        ).toMatch(/line 1:/i);
    });
});

describe('parseRule: anchoring and errors', () => {
    it('rejects trailing content, so two pasted rules do not parse as one', () => {
        expect(failure('(resource:(t:"a"))(resource:(t:"b"))').reason).toMatch(
            /line 1:/i,
        );
    });

    it('rejects an empty source', () => {
        expect(failure('').reason).toBeTruthy();
    });

    it('rejects whitespace-only source', () => {
        expect(failure('   \n  ').reason).toBeTruthy();
    });

    it('reports the line a multi-line rule actually failed on', () => {
        expect(failure('(resource:(t:"n"),\n condition:)').line).toBe(2);
    });

    it('surfaces a lexer failure as a parse failure', () => {
        expect(failure('(resource:(t:"oops))').reason).toMatch(
            /unterminated string/i,
        );
    });
});

describe('parseRule: the fixed-point guard', () => {
    const cases = [
        '(resource:(type:"notes"))',
        '(resource:(a:1)(b:2.5)(c:-3)(d:true)(e:{"x","y"})(f:{}))',
        '(resource:(t:"n"), condition:(requester.username in friends))',
        '(resource:(t:"n"), condition:requester.company = "R")',
        '(resource:(t:"n"), exchange:(to:me, resource:(t:"x"), from:requester))',
        '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) or (to:(any:(k:"v")), resource:(t:"b"), from:(all:)))',
    ];

    it.each(cases)('is a fixed point for %s', source => {
        const first = ast(source);
        const second = ast(printRule(first));
        expect(second).toEqual(first);
    });

    it('exports the reason it uses when the guard trips', () => {
        expect(NOT_REPRESENTABLE_REASON).toMatch(/advanced/i);
    });
});

describe('isSyntaxReason', () => {
    // The two forms of one distinction: `RuleCard` holds only the string,
    // `RuleEditorSheet` the whole result, and both must colour it alike.
    const sources = [
        '(resource:(t:"n"), condition:)',
        '(resource:(t:"oops))',
        '(resource:(t:"n"), condition:(a = 1), condition:(b = 2))',
        '(resource:(k:1.0))',
        '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) or (to:me, resource:(t:"c"), from:requester))',
    ];

    it.each(sources)('agrees with the presence of `at` for %s', source => {
        const result = parseRule(source);
        if (result.ok) throw new Error('expected a failure');
        expect(isSyntaxReason(result.reason)).toBe(result.at !== undefined);
    });

    it('rejects both unpositioned reasons', () => {
        expect(isSyntaxReason(MIXED_EXCHANGE_REASON)).toBe(false);
        expect(isSyntaxReason(NOT_REPRESENTABLE_REASON)).toBe(false);
    });
});

describe('parseSyntax: valid Bart the block model cannot hold', () => {
    const mixed =
        '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) or (to:me, resource:(t:"c"), from:requester))';

    it('parses a mixed and/or exchange into a tree', () => {
        const result = parseSyntax(mixed);
        if (!result.ok)
            throw new Error(`expected a parse, got: ${result.reason}`);
        expect(result.tree.resource).toEqual({ t: 'n' });
        expect(result.tree.exchange?.kind).toBe('group');
    });

    it('exposes the resource pattern that parseRule discards', () => {
        const syntax = parseSyntax(mixed);
        const blocks = parseRule(mixed);
        expect(syntax.ok && syntax.tree.resource).toEqual({ t: 'n' });
        expect(blocks.ok).toBe(false);
    });

    it('still refuses to project a mixed tree into blocks', () => {
        const result = parseSyntax(mixed);
        if (!result.ok) throw new Error('expected a parse');
        const blocks = toBlocks(result.tree);
        expect(blocks.ok).toBe(false);
        expect(blocks.ok === false && blocks.reason).toBe(
            MIXED_EXCHANGE_REASON,
        );
    });

    it('canonicalises associativity, so nesting does not change the tree', () => {
        const flat =
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) and (to:me, resource:(t:"c"), from:requester))';
        const nested =
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and ((to:me, resource:(t:"b"), from:requester) and (to:me, resource:(t:"c"), from:requester)))';
        const a = parseSyntax(flat);
        const b = parseSyntax(nested);
        if (!a.ok || !b.ok) throw new Error('expected both to parse');
        expect(b.tree).toEqual(a.tree);
    });
});

describe('parseSyntax: the printer fixed point', () => {
    const cases = [
        '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) or (to:me, resource:(t:"c"), from:requester))',
        '(resource:(t:"n"), exchange:((to:me, resource:(t:"a"), from:requester) or (to:me, resource:(t:"b"), from:requester)) and (to:me, resource:(t:"c"), from:requester))',
        '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and ((to:me, resource:(t:"b"), from:requester) or ((to:me, resource:(t:"c"), from:requester) and (to:me, resource:(t:"d"), from:requester))))',
    ];

    it.each(cases)('reprints and reparses to the same tree: %s', source => {
        const first = parseSyntax(source);
        if (!first.ok)
            throw new Error(`expected a parse, got: ${first.reason}`);
        const printed = printTree(first.tree);
        const again = parseSyntax(printed);
        if (!again.ok)
            throw new Error(`reprint did not parse: ${again.reason}`);
        expect(again.tree).toEqual(first.tree);
    });

    it.each(cases)(
        'is idempotent, so Format never keeps changing text: %s',
        source => {
            const first = parseSyntax(source);
            if (!first.ok) throw new Error('expected a parse');
            const once = printTree(first.tree);
            const twice = parseSyntax(once);
            if (!twice.ok) throw new Error('expected a reparse');
            expect(printTree(twice.tree)).toBe(once);
        },
    );
});

describe('toPolicyRule', () => {
    it('carries a pattern for a rule the block editor cannot show', () => {
        const rule = toPolicyRule(
            'rule-1',
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) or (to:me, resource:(t:"c"), from:requester))',
        );
        expect(rule.ast).toBeNull();
        expect(rule.pattern).toEqual({ t: 'n' });
        expect(rule.advancedReason).toBe(MIXED_EXCHANGE_REASON);
    });

    it('carries no pattern for a syntax error', () => {
        const rule = toPolicyRule('rule-1', '(resource:(t:"n")');
        expect(rule.ast).toBeNull();
        expect(rule.pattern).toBeNull();
        expect(isSyntaxReason(rule.advancedReason ?? '')).toBe(true);
    });
});

describe('parseRule: stage ordering when both stages would fail', () => {
    // Stage one's own fixed point rejects this tree first, so reprojection
    // never runs; the reason names that, not the mixed exchange.
    it('reports unprintability, not the mixed exchange it also has', () => {
        const source =
            '(resource:(condition:"x"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) or (to:me, resource:(t:"c"), from:requester))';
        const result = parseRule(source);
        if (result.ok) throw new Error('expected a failure');
        expect(result.reason).toBe(NOT_REPRESENTABLE_REASON);
    });
});
