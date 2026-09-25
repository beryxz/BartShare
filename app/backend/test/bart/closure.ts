'use strict';

import t from 'tap';
import { AnalyzeFn, partyClosure, PartyPattern } from '../../src/bart/closure';
import { BartAttrs } from '../../src/bart/types';

const UNDERGRAD = { studyLevel: 'undergraduate', university: 'unifi' };

const index = new Map<string, BartAttrs>([
    ['john', { username: 'john', ...UNDERGRAD }],
    ['mary', { username: 'mary', ...UNDERGRAD }],
    ['david', { username: 'david', ...UNDERGRAD }],
    ['outsider', { username: 'outsider', university: 'other' }],
]);

const policyTextOf = async (id: string) => `policy-of-${id}`;

/** Builds an AnalyzeFn from a map of "policy text" -> patterns it reports. */
function analyzerFor(byPolicy: Record<string, PartyPattern[]>): {
    fn: AnalyzeFn;
    calls: string[][];
} {
    const calls: string[][] = [];
    const fn: AnalyzeFn = async texts => {
        calls.push(texts);
        return texts.map(text => byPolicy[text] ?? []);
    };
    return { fn, calls };
}

t.test('with no quantified participants the seed is the whole set', async t => {
    t.plan(1);
    const { fn } = analyzerFor({});

    const parties = await partyClosure({
        seed: ['john', 'mary'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.same(parties, ['john', 'mary'], 'seed order preserved');
});

t.test('the ex3 case: a quantified from pulls david in', async t => {
    t.plan(1);
    const { fn } = analyzerFor({
        'policy-of-mary': [{ attrs: UNDERGRAD }],
    });

    const parties = await partyClosure({
        seed: ['john', 'mary'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.same(
        parties,
        ['john', 'mary', 'david'],
        'caller, owner, then the rest by id',
    );
});

t.test('non-matching users stay out', async t => {
    t.plan(1);
    const { fn } = analyzerFor({
        'policy-of-mary': [{ attrs: UNDERGRAD }],
    });

    const parties = await partyClosure({
        seed: ['john', 'mary'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.notOk(parties.includes('outsider'), 'different university');
});

t.test('an empty pattern is the wildcard and pulls everyone in', async t => {
    t.plan(1);
    const { fn } = analyzerFor({
        'policy-of-mary': [{ attrs: {} }],
    });

    const parties = await partyClosure({
        seed: ['john', 'mary'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.same(
        parties.slice().sort(),
        ['david', 'john', 'mary', 'outsider'],
        'everyone',
    );
});

t.test(
    'the fixpoint iterates: a party added in round 1 is expanded in round 2',
    async t => {
        t.plan(2);
        const { fn, calls } = analyzerFor({
            'policy-of-mary': [{ attrs: { username: 'david' } }],
            'policy-of-david': [{ attrs: { username: 'outsider' } }],
        });

        const parties = await partyClosure({
            seed: ['john', 'mary'],
            index,
            analyze: fn,
            policyTextOf,
        });

        t.same(
            parties.slice().sort(),
            ['david', 'john', 'mary', 'outsider'],
            'transitive',
        );
        // round 1: [john, mary]; round 2: [david]; round 3: [outsider], empty.
        t.equal(
            calls.length,
            3,
            'one batched analyze call per round, not one per policy',
        );
    },
);

t.test('a cycle terminates', async t => {
    t.plan(1);
    const { fn } = analyzerFor({
        'policy-of-mary': [{ attrs: { username: 'david' } }],
        'policy-of-david': [{ attrs: { username: 'mary' } }],
    });

    const parties = await partyClosure({
        seed: ['john', 'mary'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.same(
        parties,
        ['john', 'mary', 'david'],
        'mary and david point at each other',
    );
});

t.test('to-role patterns expand the set as well as from-role ones', async t => {
    t.plan(1);
    const { fn } = analyzerFor({
        'policy-of-mary': [{ attrs: { username: 'david' } }],
    });

    const parties = await partyClosure({
        seed: ['john', 'mary'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.ok(parties.includes('david'), 'a `to:(any:…)` reaches a party too');
});

t.test('a pattern matching nobody adds nobody', async t => {
    t.plan(1);
    const { fn } = analyzerFor({
        'policy-of-mary': [{ attrs: { username: 'ghost' } }],
    });

    const parties = await partyClosure({
        seed: ['john', 'mary'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.same(parties, ['john', 'mary'], 'unchanged');
});

t.test('a seed member missing from the index is still a party', async t => {
    t.plan(1);
    const { fn } = analyzerFor({});

    const parties = await partyClosure({
        seed: ['john', 'ghost'],
        index,
        analyze: fn,
        policyTextOf,
    });

    t.same(parties, ['john', 'ghost'], 'the seed is authoritative');
});

t.test('a condition-only party reference pulls that party in', async t => {
    t.plan(1);
    // john's policy names no any/all participant; mary is reached only via the
    // condition's `role:auditor` pattern.
    const { fn } = analyzerFor({
        'policy-of-john': [{ attrs: { role: 'auditor' } }],
    });

    const parties = await partyClosure({
        seed: ['john'],
        index: new Map<string, BartAttrs>([
            ['john', { username: 'john' }],
            ['mary', { username: 'mary', role: 'auditor' }],
            ['outsider', { username: 'outsider' }],
        ]),
        analyze: fn,
        policyTextOf,
    });

    t.same(parties, ['john', 'mary'], 'the auditor is discovered');
});
