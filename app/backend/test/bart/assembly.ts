'use strict';

import t from 'tap';
import { userForLocation } from '../../src/bart/assembly';

const texts = ['policy-of-caller', 'policy-of-owner'];
const textOwners = new Map<string, string>([
    ['policy-of-caller', 'caller-id'],
    ['policy-of-owner', 'owner-id'],
]);

t.test('resolves "policy N" to the owner of the Nth text', async t => {
    t.plan(2);
    t.equal(
        userForLocation('policy 1', texts, textOwners),
        'caller-id',
        'first',
    );
    t.equal(
        userForLocation('policy 2', texts, textOwners),
        'owner-id',
        'second',
    );
});

t.test('a null location resolves to null', async t => {
    t.plan(1);
    t.equal(userForLocation(null, texts, textOwners), null);
});

t.test('a location not shaped like "policy N" resolves to null', async t => {
    t.plan(1);
    t.equal(userForLocation('somewhere else', texts, textOwners), null);
});

t.test('an out-of-range index resolves to null', async t => {
    t.plan(1);
    t.equal(userForLocation('policy 99', texts, textOwners), null);
});

t.test('a text absent from textOwners resolves to null', async t => {
    t.plan(1);
    const unrelatedTexts = ['some-other-text'];
    t.equal(userForLocation('policy 1', unrelatedTexts, textOwners), null);
});
