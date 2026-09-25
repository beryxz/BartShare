'use strict';

import t from 'tap';
import { matches } from '../../src/bart/matcher';

t.test('an empty pattern is the wildcard', async t => {
    t.plan(2);
    t.ok(matches({}, { a: 'x' }), 'matches a party with attributes');
    t.ok(matches({}, {}), 'matches a party without');
});

t.test('subset match: extra party attributes are irrelevant', async t => {
    t.plan(2);
    t.ok(matches({ a: 'x' }, { a: 'x', b: 'y' }), 'party has more');
    t.notOk(matches({ a: 'x', b: 'y' }, { a: 'x' }), 'pattern has more');
});

t.test('a differing value fails', async t => {
    t.plan(1);
    t.notOk(matches({ a: 'x' }, { a: 'y' }), 'values differ');
});

t.test('types are not coerced', async t => {
    t.plan(2);
    t.notOk(matches({ a: 1 }, { a: '1' }), 'number vs string');
    t.notOk(matches({ a: true }, { a: 'true' }), 'boolean vs string');
});

t.test('arrays compare as bags', async t => {
    t.plan(4);
    t.ok(
        matches({ a: ['x', 'y'] }, { a: ['y', 'x'] }),
        'order does not matter',
    );
    t.notOk(matches({ a: ['x'] }, { a: ['x', 'x'] }), 'duplicates do matter');
    t.notOk(matches({ a: ['x'] }, { a: ['x', 'y'] }), 'not a subset relation');
    t.ok(matches({ a: [] }, { a: [] }), 'empty collections are equal');
});

t.test('an array never equals a scalar', async t => {
    t.plan(2);
    t.notOk(
        matches({ a: ['x'] }, { a: 'x' }),
        'one-element array vs the element',
    );
    t.notOk(matches({ a: 'x' }, { a: ['x'] }), 'and the reverse');
});

t.test('a mixed-type collection compares elementwise', async t => {
    t.plan(2);
    t.ok(matches({ a: ['x', 1] }, { a: [1, 'x'] }), 'reordered mixed types');
    t.notOk(matches({ a: ['1'] }, { a: [1] }), 'string 1 is not number 1');
});

t.test('a missing key fails rather than matching loosely', async t => {
    t.plan(1);
    t.notOk(matches({ a: 'x' }, { b: 'x' }), 'key absent');
});
