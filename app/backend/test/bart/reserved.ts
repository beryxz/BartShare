'use strict';

import t from 'tap';
import { providerKeys } from '../../src/bart/context';
import { emitAttrs } from '../../src/bart/emitter';
import {
    RESERVED_ATTR_NAMES,
    validateAttrs,
    validatePartyPattern,
} from '../../src/bart/reserved';

t.test(
    'the reserved set is derived from the providers plus userId',
    async t => {
        t.plan(2);
        t.ok(
            RESERVED_ATTR_NAMES.has('userId'),
            'the injected identity attribute',
        );
        for (const key of providerKeys()) {
            if (!RESERVED_ATTR_NAMES.has(key))
                t.fail(`provider key '${key}' is not reserved`);
        }
        t.equal(
            RESERVED_ATTR_NAMES.size,
            providerKeys().length + 1,
            'exactly the provider keys plus userId, nothing hand-added',
        );
    },
);

t.test('valid attrs produce no errors', async t => {
    t.plan(1);
    t.same(
        validateAttrs({ a: 'x', b: 3, c: true, d: ['x', 1], e: [] }),
        [],
        'every supported value form',
    );
});

t.test('reserved keys are rejected', async t => {
    t.plan(3);
    t.equal(validateAttrs({ userId: 'x' }).length, 1, 'userId');
    t.equal(validateAttrs({ connections: [] }).length, 1, 'connections');
    t.equal(validateAttrs({ date_year: 1 }).length, 1, 'date_year');
});

t.test('reserved matching is case-sensitive, like Bart NAMEs', async t => {
    t.plan(1);
    t.same(
        validateAttrs({ UserId: 'x' }),
        [],
        'UserId is a different, legal name',
    );
});

t.test(
    'Bart keywords are rejected even though they match the name regex',
    async t => {
        t.plan(4);
        t.equal(validateAttrs({ to: 'x' }).length, 1, 'to');
        t.equal(validateAttrs({ exchange: 'x' }).length, 1, 'exchange');
        t.equal(validateAttrs({ false: 'x' }).length, 1, 'false');
        t.same(validateAttrs({ toName: 'x' }), [], 'a keyword prefix is fine');
    },
);

t.test('keys must be valid Bart names', async t => {
    t.plan(4);
    t.equal(validateAttrs({ 'a.b': 'x' }).length, 1, 'dot');
    t.equal(validateAttrs({ 'a-b': 'x' }).length, 1, 'dash');
    t.equal(validateAttrs({ '1a': 'x' }).length, 1, 'leading digit');
    t.equal(validateAttrs({ '': 'x' }).length, 1, 'empty key');
});

t.test('values are restricted to what the emitter can write', async t => {
    t.plan(6);
    t.equal(validateAttrs({ a: 'he said "hi"' }).length, 1, 'double quote');
    t.equal(validateAttrs({ a: 'a\\b' }).length, 1, 'backslash');
    t.equal(validateAttrs({ a: 'a\u0000b' }).length, 1, 'control character');
    t.equal(validateAttrs({ a: Number.NaN }).length, 1, 'NaN');
    t.equal(validateAttrs({ a: null }).length, 1, 'null');
    t.equal(validateAttrs({ a: { b: 1 } }).length, 1, 'nested object');
});

t.test('arrays must be flat and of supported scalars', async t => {
    t.plan(2);
    t.equal(validateAttrs({ a: [['x']] }).length, 1, 'nested array');
    t.equal(validateAttrs({ a: [null] }).length, 1, 'null element');
});

t.test('spaces and accents are allowed', async t => {
    t.plan(1);
    t.same(
        validateAttrs({ course: 'Analisi Matematica', who: 'Müller' }),
        [],
        'permissive',
    );
});

t.test('every offending key is reported, not just the first', async t => {
    t.plan(1);
    t.equal(validateAttrs({ 'a.b': 'x', userId: 'y' }).length, 2, 'two errors');
});

t.test(
    'round trip: whatever validateAttrs accepts, emitAttrs can write',
    async t => {
        t.plan(2);
        const attrs = {
            course: 'Analisi Matematica',
            who: 'Müller',
            age: 3,
            active: true,
            tags: ['x', 'y'],
            empty: [],
        };
        t.same(validateAttrs(attrs), [], 'accepted by the write-time gate');
        t.doesNotThrow(
            () => emitAttrs(attrs),
            'and therefore emittable: the two must never drift',
        );
    },
);

t.test('validatePartyPattern permits userId', async t => {
    t.plan(3);

    t.same(
        validatePartyPattern({ userId: 'abc', degreeProgram: 'cs' }),
        [],
        'userId is how you name one party',
    );
    t.equal(
        validatePartyPattern({ connections: ['x'] }).length,
        1,
        'a context key is never a party attribute',
    );
    t.equal(
        validatePartyPattern({ to: 'x' }).length,
        1,
        'a grammar keyword is still rejected',
    );
});

t.test(
    'validatePartyPattern errors are prefixed `from:`, not `attrs:`',
    async t => {
        t.plan(2);

        // The `from:` prefix is the only thing distinguishing these from
        // validateAttrs' messages.
        t.same(
            validatePartyPattern({ 'a.b': 'x' }),
            [
                "from: key 'a.b' is not a valid Bart name (letters, digits and underscore; may not start with a digit)",
            ],
            'an invalid name reports under from:',
        );
        t.same(
            validatePartyPattern({ a: ['ok', 'b"d'] }),
            [
                "from: element of 'a' may not contain '\"', '\\' or control characters",
            ],
            'a bad array element reports under from:',
        );
    },
);

/**
 * The emitter itself is the oracle, not a regex: the exact-integer bound is part of what it
 * will write, so comparing against `NUMBER_RE` alone would miss the pair either side of 2^53.
 */
t.test('validateAttrs: the gate and the emitter agree on numbers', async t => {
    const values = [
        1e-7,
        1e21,
        1e100,
        -1e-7,
        0.1,
        3,
        -3,
        0,
        Number.MIN_VALUE,
        1e20,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER + 1,
        -(Number.MAX_SAFE_INTEGER + 1),
    ];
    t.plan(values.length);
    for (const value of values) {
        const accepted = validateAttrs({ k: value }).length === 0;
        let emittable = true;
        try {
            emitAttrs({ k: value });
        } catch {
            emittable = false;
        }
        t.equal(
            accepted,
            emittable,
            `${value}: gate accepts iff the emitter can write it`,
        );
    }
});

/** The three number clauses are one predicate, so each has to name its own reason. */
t.test('validateAttrs: a rejected number says which clause failed', async t => {
    t.plan(4);
    t.match(
        validateAttrs({ k: 1e20 })[0],
        /outside the exact integer range/,
        'an integer past 2^53',
    );
    t.match(
        validateAttrs({ k: -1e20 })[0],
        /outside the exact integer range/,
        'and the same below -2^53, where "too large" would misread',
    );
    t.match(
        validateAttrs({ k: 1e-7 })[0],
        /no exponent notation/,
        'a decimal that renders in exponent form',
    );
    t.match(
        validateAttrs({ k: Number.POSITIVE_INFINITY })[0],
        /must be a finite number/,
        'a non-finite value',
    );
});
