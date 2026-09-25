import { describe, expect, it } from 'vitest';
import {
    ExchangeGroup,
    ExchangeNode,
    ExchangeTerm,
    groupNode,
    normalizeExchange,
    printRule,
    printTree,
    RuleAst,
    toTree,
    tryPrintTree,
} from './rule';

const TERM_A: ExchangeTerm = {
    to: { kind: 'me' },
    resource: { type: 'exercises' },
    from: { kind: 'requester' },
};
const TERM_B: ExchangeTerm = {
    to: { kind: 'me' },
    resource: { type: 'lectureNotes' },
    from: { kind: 'requester' },
};
const TERM_C: ExchangeTerm = {
    to: { kind: 'me' },
    resource: { type: 'slides' },
    from: { kind: 'all', attrs: { university: 'unifi' } },
};

describe('printRule', () => {
    it('emits a resource-only rule', () => {
        expect(printRule({ resource: { type: 'notes' } })).toBe(
            '(resource:(type:"notes"))',
        );
    });

    it('wraps the condition in parentheses', () => {
        const ast: RuleAst = {
            resource: { type: 'notes' },
            condition: 'requester.username in friends',
        };
        expect(printRule(ast)).toBe(
            '(resource:(type:"notes"), condition:(requester.username in friends))',
        );
    });

    it('drops an empty condition rather than emitting condition:()', () => {
        expect(printRule({ resource: { type: 'notes' }, condition: '' })).toBe(
            '(resource:(type:"notes"))',
        );
    });

    it('emits a single term with no connector and no wrapping parens', () => {
        const ast: RuleAst = {
            resource: { type: 'notes' },
            exchange: { connector: 'and', terms: [TERM_A] },
        };
        expect(printRule(ast, 1000)).toBe(
            '(resource:(type:"notes"), exchange:(to:me, resource:(type:"exercises"), from:requester))',
        );
    });

    it('emits a multi-term chain inside one pair of parens', () => {
        const ast: RuleAst = {
            resource: { type: 'n' },
            exchange: { connector: 'or', terms: [TERM_A, TERM_B] },
        };
        expect(printRule(ast, 1000)).toBe(
            '(resource:(type:"n"), exchange:((to:me, resource:(type:"exercises"), from:requester) or (to:me, resource:(type:"lectureNotes"), from:requester)))',
        );
    });

    it('renders a quantified participant with its pattern', () => {
        const ast: RuleAst = {
            resource: { type: 'n' },
            exchange: { connector: 'and', terms: [TERM_C] },
        };
        expect(printRule(ast, 1000)).toContain(
            'from:(all:(university:"unifi"))',
        );
    });

    it('renders an empty quantified pattern as the bare quantifier', () => {
        const ast: RuleAst = {
            resource: { type: 'n' },
            exchange: {
                connector: 'and',
                terms: [
                    {
                        to: { kind: 'me' },
                        resource: { type: 'x' },
                        from: { kind: 'any', attrs: {} },
                    },
                ],
            },
        };
        expect(printRule(ast, 1000)).toContain('from:(any:)');
    });

    it('throws when the rule pattern is empty', () => {
        expect(() => printRule({ resource: {} })).toThrow(
            /rule needs at least one resource attribute/,
        );
    });

    it('throws when an exchange term pattern is empty', () => {
        const ast: RuleAst = {
            resource: { type: 'n' },
            exchange: {
                connector: 'and',
                terms: [{ ...TERM_A, resource: {} }],
            },
        };
        expect(() => printRule(ast)).toThrow(
            /exchange needs at least one resource attribute/,
        );
    });

    it('throws when an exchange has no terms', () => {
        const ast: RuleAst = {
            resource: { type: 'n' },
            exchange: { connector: 'and', terms: [] },
        };
        expect(() => printRule(ast)).toThrow(/at least one term/);
    });
});

describe('printRule line breaking', () => {
    const wide: RuleAst = {
        resource: { type: 'lectureNotes', course: 'ads', teacher: 'doe' },
        condition: 'requester.username in friends',
        exchange: { connector: 'or', terms: [TERM_A, TERM_B] },
    };

    /** Continuation terms align under the first, i.e. past `' exchange:('`. */
    const indent = ' '.repeat(' exchange:('.length);

    it('stays on one line when it fits', () => {
        expect(printRule({ resource: { a: 1 } }, 80)).not.toContain('\n');
    });

    it('breaks at top-level clauses when it does not fit', () => {
        const lines = printRule(wide, 80).split('\n');
        expect(lines[0]).toBe(
            '(resource:(type:"lectureNotes")(course:"ads")(teacher:"doe"),',
        );
        expect(lines[1]).toBe(' condition:(requester.username in friends),');
    });

    it('breaks a multi-term exchange with the connector on its own line', () => {
        const lines = printRule(wide, 80).split('\n');
        // Terms sit one column further in than the connector: the chain adds a
        // wrapping paren, and each term's keys align under its own `to:`.
        expect(lines.slice(2)).toEqual([
            ' exchange:((to:me,',
            `${indent} resource:(type:"exercises"),`,
            `${indent} from:requester)`,
            `${indent}or`,
            `${indent}(to:me,`,
            `${indent} resource:(type:"lectureNotes"),`,
            `${indent} from:requester)))`,
        ]);
    });

    it('breaks a single-term exchange onto its keys', () => {
        const out = printRule(
            {
                resource: { type: 'lectureNotes', course: 'ads' },
                condition: 'requester.username in friends and date_year > 2025',
                exchange: { connector: 'and', terms: [TERM_A] },
            },
            80,
        );
        // A lone term has no wrapping paren, so its keys align at `indent`.
        expect(out.split('\n')).toEqual([
            '(resource:(type:"lectureNotes")(course:"ads"),',
            ' condition:(requester.username in friends and date_year > 2025),',
            ' exchange:(to:me,',
            `${indent}resource:(type:"exercises"),`,
            `${indent}from:requester))`,
        ]);
    });

    it('leaves a rule that fits within the width on one line', () => {
        const ast: RuleAst = {
            resource: { type: 'notes' },
            exchange: { connector: 'and', terms: [TERM_A] },
        };
        expect(printRule(ast, 1000)).toBe(
            '(resource:(type:"notes"), exchange:(to:me, resource:(type:"exercises"), from:requester))',
        );
    });
});

describe('normalizeExchange', () => {
    it('forces a lone term onto the "and" connector', () => {
        const group: ExchangeGroup = { connector: 'or', terms: [TERM_A] };
        expect(normalizeExchange(group)).toEqual({
            connector: 'and',
            terms: [TERM_A],
        });
    });

    it('leaves a multi-term group alone', () => {
        const group: ExchangeGroup = {
            connector: 'or',
            terms: [TERM_A, TERM_B],
        };
        expect(normalizeExchange(group)).toBe(group);
    });
});

/** A minimal well-formed term, distinguished only by its resource type. */
function term(type: string): ExchangeNode {
    const value: ExchangeTerm = {
        to: { kind: 'me' },
        resource: { type },
        from: { kind: 'requester' },
    };
    return { kind: 'term', term: value };
}

describe('groupNode', () => {
    it('returns a lone child bare rather than wrapping it', () => {
        expect(groupNode('and', [term('a')])).toEqual(term('a'));
    });

    it('collapses a child that already carries the same connector', () => {
        const inner = groupNode('and', [term('a'), term('b')]);
        expect(groupNode('and', [inner, term('c')])).toEqual({
            kind: 'group',
            connector: 'and',
            children: [term('a'), term('b'), term('c')],
        });
    });

    it('keeps a child whose connector differs', () => {
        const inner = groupNode('and', [term('a'), term('b')]);
        expect(groupNode('or', [inner, term('c')])).toEqual({
            kind: 'group',
            connector: 'or',
            children: [inner, term('c')],
        });
    });
});

/** The printed form of the term `type` builds. */
function printed(type: string): string {
    return `(to:me, resource:(type:"${type}"), from:requester)`;
}

describe('printTree', () => {
    it('prints a mixed tree with the nested group parenthesised', () => {
        const tree = {
            resource: { type: 'notes' },
            condition: null,
            exchange: groupNode('or', [
                groupNode('and', [term('a'), term('b')]),
                term('c'),
            ]),
        };
        expect(printTree(tree, 500)).toBe(
            '(resource:(type:"notes"), exchange:' +
                `((${printed('a')} and ${printed('b')}) or ${printed('c')}))`,
        );
    });

    it('prints a homogeneous chain flat, with no inner parentheses', () => {
        const tree = {
            resource: { type: 'notes' },
            condition: null,
            exchange: groupNode('and', [term('a'), term('b'), term('c')]),
        };
        expect(printTree(tree, 500)).toBe(
            '(resource:(type:"notes"), exchange:' +
                `(${printed('a')} and ${printed('b')} and ${printed('c')}))`,
        );
    });

    it('reports an empty exchange as a failure rather than printing "()"', () => {
        const tree = {
            resource: { type: 'notes' },
            condition: null,
            exchange: {
                kind: 'group' as const,
                connector: 'and' as const,
                children: [],
            },
        };
        expect(tryPrintTree(tree).ok).toBe(false);
    });
});

describe('printRule over printTree', () => {
    it('is unchanged for a single-term exchange', () => {
        const ast: RuleAst = {
            resource: { type: 'notes' },
            exchange: {
                connector: 'and',
                terms: [
                    {
                        to: { kind: 'me' },
                        resource: { type: 'a' },
                        from: { kind: 'requester' },
                    },
                ],
            },
        };
        expect(printRule(ast, 500)).toBe(
            '(resource:(type:"notes"), exchange:(to:me, resource:(type:"a"), from:requester))',
        );
    });

    it('round-trips an AST through toTree without changing the text', () => {
        const ast: RuleAst = {
            resource: { type: 'notes' },
            condition: 'requester.userId in connections',
            exchange: {
                connector: 'or',
                terms: [
                    {
                        to: { kind: 'me' },
                        resource: { type: 'a' },
                        from: { kind: 'requester' },
                    },
                    {
                        to: { kind: 'me' },
                        resource: { type: 'b' },
                        from: { kind: 'requester' },
                    },
                ],
            },
        };
        expect(printTree(toTree(ast), 500)).toBe(printRule(ast, 500));
    });
});
