'use strict';

import t from 'tap';
import {
    BartEmitError,
    emitAttrList,
    emitAttrs,
    emitPolicy,
    emitRequest,
    partyAttrsOf,
} from '../../src/bart/emitter';

t.test('emitAttrs: scalars by type', async t => {
    t.plan(3);
    t.equal(emitAttrs({ a: 'x' }), '(a:"x")', 'string is quoted');
    t.equal(emitAttrs({ a: 3 }), '(a:3)', 'number is bare');
    t.equal(emitAttrs({ a: true }), '(a:true)', 'boolean is bare');
});

t.test(
    'emitAttrs: several attributes concatenate in insertion order',
    async t => {
        t.plan(1);
        t.equal(
            emitAttrs({ b: 'y', a: 'x' }),
            '(b:"y")(a:"x")',
            'order preserved',
        );
    },
);

t.test('emitAttrs: arrays always use brace form', async t => {
    t.plan(3);
    t.equal(emitAttrs({ a: [] }), '(a:{})', 'empty array');
    t.equal(
        emitAttrs({ a: ['x'] }),
        '(a:{"x"})',
        'one element stays a collection',
    );
    t.equal(emitAttrs({ a: ['x', 'y'] }), '(a:{"x","y"})', 'many elements');
});

t.test('emitAttrs: quote and backslash are escaped', async t => {
    t.plan(2);
    t.equal(
        emitAttrs({ a: 'he said "hi"' }),
        '(a:"he said \\"hi\\"")',
        'quote',
    );
    t.equal(emitAttrs({ a: 'a\\b' }), '(a:"a\\\\b")', 'backslash');
});

t.test('emitAttrs: an empty object emits nothing', async t => {
    t.plan(1);
    t.equal(emitAttrs({}), '', 'no attributes');
});

t.test(
    'emitAttrs: rejects Bart keywords that match the NAME regex',
    async t => {
        t.plan(4);
        // ANTLR literals outrank NAME, so these lex as tokens and never reach the NAME rule.
        t.throws(() => emitAttrs({ to: 'x' }), BartEmitError, 'to');
        t.throws(() => emitAttrs({ any: 'x' }), BartEmitError, 'any');
        t.throws(() => emitAttrs({ true: 'x' }), BartEmitError, 'true');
        t.doesNotThrow(
            () => emitAttrs({ toName: 'x' }),
            'a keyword prefix is still fine',
        );
    },
);

t.test(
    'emitPolicy: a userId carried in attrs cannot override the row id',
    async t => {
        t.plan(1);
        t.equal(
            emitPolicy({
                id: 'real',
                attrs: { userId: 'spoofed', a: 'x' },
                rules: [],
            }),
            '(party:(userId:"real")(a:"x"), rules:())',
            'the injected primary key wins on value and keeps its leading position',
        );
    },
);

t.test(
    'partyAttrsOf: discards a carried userId and injects the row id first',
    async t => {
        t.plan(2);
        t.same(
            partyAttrsOf({ id: 'real', attrs: { userId: 'spoofed', a: 'x' } }),
            { userId: 'real', a: 'x' },
            'the row id wins on value',
        );
        t.same(
            Object.keys(
                partyAttrsOf({
                    id: 'real',
                    attrs: { userId: 'spoofed', a: 'x' },
                }),
            ),
            ['userId', 'a'],
            'userId stays in first position',
        );
    },
);

t.test('partyAttrsOf: this is what emitPolicy actually emits', async t => {
    t.plan(1);
    const user = { id: 'u1', attrs: { username: 'mary' } };
    t.equal(
        emitAttrs(partyAttrsOf(user)),
        '(userId:"u1")(username:"mary")',
        'the closure index must match against exactly this',
    );
});

t.test('emitAttrs: rejects what the grammar cannot express', async t => {
    t.plan(5);
    t.throws(() => emitAttrs({ 'a.b': 'x' }), BartEmitError, 'dotted key');
    t.throws(
        () => emitAttrs({ '1a': 'x' }),
        BartEmitError,
        'key starting with a digit',
    );
    // @ts-expect-error deliberately invalid value
    t.throws(() => emitAttrs({ a: null }), BartEmitError, 'null');
    // @ts-expect-error deliberately invalid value
    t.throws(() => emitAttrs({ a: { b: 1 } }), BartEmitError, 'nested object');
    t.throws(
        () => emitAttrs({ a: Number.NaN }),
        BartEmitError,
        'non-finite number',
    );
});

t.test('emitAttrList: an empty party context is ()', async t => {
    t.plan(2);
    t.equal(emitAttrList({}), '()', 'empty');
    t.equal(
        emitAttrList({ a: 'x' }),
        '(a:"x")',
        'non-empty is the bare attribute list',
    );
});

t.test('emitPolicy: userId is injected first', async t => {
    t.plan(1);
    t.equal(
        emitPolicy({ id: 'u1', attrs: { username: 'mary' }, rules: [] }),
        '(party:(userId:"u1")(username:"mary"), rules:())',
        'policy text',
    );
});

t.test('emitPolicy: a rule-less party gets rules:()', async t => {
    t.plan(1);
    t.equal(
        emitPolicy({ id: 'u1', attrs: {}, rules: [] }),
        '(party:(userId:"u1"), rules:())',
        'never an omission: an omitted party degrades into a silent deny',
    );
});

t.test(
    'emitPolicy: rules are concatenated verbatim, newline-separated',
    async t => {
        t.plan(1);
        t.equal(
            emitPolicy({
                id: 'u1',
                attrs: {},
                rules: ['(resource:(type:"a"))', '(resource:(type:"b"))'],
            }),
            '(party:(userId:"u1"), rules:(resource:(type:"a"))\n(resource:(type:"b")))',
            'policy text',
        );
    },
);

t.test('emitRequest: targets the owner by userId', async t => {
    t.plan(1);
    t.equal(
        emitRequest(
            1,
            { type: 'lectureNotes', course: 'ads' },
            {
                quantifier: 'any',
                attrs: { userId: 'owner-1' },
            },
        ),
        '1 : (resource:(type:"lectureNotes")(course:"ads"), from:(any:(userId:"owner-1")))',
        'request line',
    );
});

t.test('emitRequest: rejects a resource with no attributes', async t => {
    t.plan(1);
    t.throws(
        () =>
            emitRequest(
                1,
                {},
                { quantifier: 'any', attrs: { userId: 'owner-1' } },
            ),
        BartEmitError,
        'the grammar requires attribute+, and an empty resource is a wildcard',
    );
});

t.test(
    'emitRequest: decideAccess call shape is byte-identical to the pre-refactor literal',
    async t => {
        t.plan(1);
        // access.service.ts builds its request line through this same call;
        // keeping the literal exact catches any drift in that shape.
        t.equal(
            emitRequest(
                1,
                { type: 'assignment', course: 'ads' },
                { quantifier: 'any', attrs: { userId: 'owner-42' } },
            ),
            '1 : (resource:(type:"assignment")(course:"ads"), from:(any:(userId:"owner-42")))',
            'decideAccess request line is unchanged',
        );
    },
);

t.test('emitRequest targets a quantified party pattern', async t => {
    t.plan(2);

    t.equal(
        emitRequest(
            1,
            { type: 'lectureNotes' },
            { quantifier: 'all', attrs: { degreeProgram: 'cs' } },
        ),
        '1 : (resource:(type:"lectureNotes"), from:(all:(degreeProgram:"cs")))',
        'all is emitted',
    );
    t.equal(
        emitRequest(2, { type: 'exercises' }, { quantifier: 'any', attrs: {} }),
        '2 : (resource:(type:"exercises"), from:(any:))',
        'an empty pattern is the any-party wildcard',
    );
});

const user = (rules: string[]) => ({
    id: 'u1',
    attrs: { username: 'u' },
    rules,
});

t.test('emitPolicy: rules are separated by a newline', async t => {
    t.plan(1);
    t.equal(
        emitPolicy(
            user(['(resource:(kind:"doc"))', '(resource:(kind:"photo"))']),
        ),
        '(party:(userId:"u1")(username:"u"), rules:(resource:(kind:"doc"))\n(resource:(kind:"photo")))',
        'a newline separates them',
    );
});

t.test(
    'emitPolicy: a trailing comment does not swallow the next rule',
    async t => {
        t.plan(2);
        // Bart.g4: COMMENT : '#' ~[\r\n]* -> skip. Joined with '', it would run
        // into rule 2 and delete it, while the assembled text still validates.
        const text = emitPolicy(
            user([
                '(resource:(kind:"doc"))\n# note',
                '(resource:(kind:"photo"))\n',
            ]),
        );
        t.notMatch(text, /#/, 'the comment is gone');
        t.match(text, /\(kind:"photo"\)/, 'rule 2 survives');
    },
);

t.test('emitPolicy: a # inside a string literal is not a comment', async t => {
    t.plan(1);
    // STRING : '"' (~["\\] | '\\' .)* '"' -- '#' is an ordinary character inside quotes.
    t.equal(
        emitPolicy(user(['(resource:(name:"issue#42"))'])),
        '(party:(userId:"u1")(username:"u"), rules:(resource:(name:"issue#42")))',
        'the string is untouched',
    );
});

t.test('emitPolicy: both halves of the fix hold at once', async t => {
    t.plan(4);
    // Combines both failure modes: a `#` inside a string must survive (a naive
    // /#.*$/ strip would corrupt it) while a trailing comment must still be
    // stripped (joining with '' alone would let it swallow rule 2).
    const text = emitPolicy(
        user([
            '(resource:(name:"issue#42"))\n# note',
            '(resource:(kind:"photo"))',
        ]),
    );
    t.match(text, /\(name:"issue#42"\)/, 'the # inside the string survives');
    t.notMatch(text, /# note/, 'the trailing comment is gone');
    t.match(text, /\(kind:"photo"\)/, 'the comment did not eat the next rule');
    t.match(
        text,
        /\)\)\n\n\(resource:\(kind:"photo"\)\)/,
        'and the rules stay newline-separated, not concatenated',
    );
});

t.test('emitPolicy: an escaped quote does not end the string', async t => {
    t.plan(1);
    t.equal(
        emitPolicy(user(['(resource:(name:"a\\"b#c"))'])),
        '(party:(userId:"u1")(username:"u"), rules:(resource:(name:"a\\"b#c")))',
        'the # stays inside the string',
    );
});

t.test('emitPolicy: rules that are only comments fall back to ()', async t => {
    t.plan(1);
    t.equal(
        emitPolicy(user(['# just a note'])),
        '(party:(userId:"u1")(username:"u"), rules:())',
        'an empty rule list, not a dangling "rules:"',
    );
});

t.test('emitScalar: exponent-notation numbers are rejected', async t => {
    t.plan(3);
    // Bart.g4: NUMBER : '-'? [0-9]+ ('.' [0-9]+)? -- no exponent form. JS switches
    // String() to exponent notation at |v| >= 1e21 and |v| < 1e-6.
    t.throws(() => emitAttrs({ a: 1e-7 }), BartEmitError, '1e-7');
    t.throws(() => emitAttrs({ a: 1e21 }), BartEmitError, '1e+21');
    t.throws(() => emitAttrs({ a: 1e100 }), BartEmitError, '1e+100');
});

t.test('emitScalar: ordinary numbers still emit bare', async t => {
    t.plan(4);
    t.equal(emitAttrs({ a: 3 }), '(a:3)', 'integer');
    t.equal(emitAttrs({ a: -3 }), '(a:-3)', 'negative');
    t.equal(emitAttrs({ a: 0.1 }), '(a:0.1)', 'decimal');
    t.equal(emitAttrs({ a: 1e-6 }), '(a:0.000001)', 'just inside the band');
});
