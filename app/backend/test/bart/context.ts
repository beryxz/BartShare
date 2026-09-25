'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import {
    buildContextTuple,
    ContextProvider,
    CONTEXT_PROVIDERS,
    providerKeys,
} from '../../src/bart/context';
import { connectionsProvider } from '../../src/bart/context/connections.provider';
import { dateProvider } from '../../src/bart/context/date.provider';
import { groupsProvider } from '../../src/bart/context/groups.provider';
import { Group, User } from '../../src/models/models';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let alice: User;
let bob: User;
let carol: User;
let group: Group;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    alice = await User.create({ attrs: { username: 'alice' }, rules: [] });
    bob = await User.create({ attrs: { username: 'bob' }, rules: [] });
    carol = await User.create({ attrs: { username: 'carol' }, rules: [] });
    group = await Group.create({ name: 'g1', description: 'd' });

    await alice.addConnection(bob);
    await bob.addConnection(alice);
    await alice.addGroup(group);
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('date provider: one snapshot shared by every party', async t => {
    t.plan(3);
    const now = new Date(Date.UTC(2026, 6, 28, 12, 0, 0));

    const result = await dateProvider.contribute(['a', 'b'], { now });

    t.same(
        result.get('a'),
        { date_year: 2026, date_month: 7, date_day: 28 },
        'party a',
    );
    t.same(result.get('b'), result.get('a'), 'identical for every party');
    t.same(
        dateProvider.keys.map(k => k.name),
        ['date_year', 'date_month', 'date_day'],
        'declared keys',
    );
});

t.test('provider keys are unique across providers', async t => {
    t.plan(1);
    const keys = providerKeys();
    t.equal(
        new Set(keys).size,
        keys.length,
        'no two providers claim the same key',
    );
});

// reserved.ts derives its blacklist from these declarations, so an undeclared
// key would silently escape it. Covers every data state a provider branches on.
t.test('every provider declares the keys it actually emits', async t => {
    t.plan(CONTEXT_PROVIDERS.length * 3);
    const now = new Date();
    const absentId = '00000000-0000-0000-0000-000000000000';

    for (const provider of CONTEXT_PROVIDERS) {
        const declared = provider.keys.map(key => key.name).sort();
        const result = await provider.contribute(
            [alice.id, carol.id, absentId],
            { now },
        );

        t.same(
            Object.keys(result.get(alice.id) ?? {}).sort(),
            declared,
            `${provider.name}: party with rows`,
        );
        t.same(
            Object.keys(result.get(carol.id) ?? {}).sort(),
            declared,
            `${provider.name}: party with no rows in the join table`,
        );
        t.same(
            Object.keys(result.get(absentId) ?? {}).sort(),
            declared,
            `${provider.name}: party absent from the users table`,
        );
    }
});

t.test(
    'two providers claiming the same key is an error, not last-wins',
    async t => {
        t.plan(1);
        const collide = (name: string): ContextProvider => ({
            name,
            keys: [
                {
                    name: 'shared_key',
                    description: 'A stub provider for the collision test.',
                    example: 'shared_key',
                },
            ],
            contribute: async ids =>
                new Map(ids.map(id => [id, { shared_key: name }])),
        });

        await t.rejects(
            buildContextTuple([alice.id], { now: new Date() }, [
                collide('first'),
                collide('second'),
            ]),
            /collide on 'shared_key'/,
            'a silent last-wins merge would hide one provider entirely',
        );
    },
);

t.test('connections provider: mutual connections, as a collection', async t => {
    t.plan(2);

    const result = await connectionsProvider.contribute([alice.id, carol.id], {
        now: new Date(),
    });

    t.same(
        result.get(alice.id),
        { connections: [bob.id] },
        'alice is connected to bob',
    );
    t.same(result.get(carol.id), { connections: [] }, 'carol has none');
});

t.test('groups provider: membership as a collection', async t => {
    t.plan(2);

    const result = await groupsProvider.contribute([alice.id, carol.id], {
        now: new Date(),
    });

    t.same(result.get(alice.id), { groups: [group.id] }, 'alice is a member');
    t.same(result.get(carol.id), { groups: [] }, 'carol is not');
});

t.test('the tuple has one slot per party, in party order', async t => {
    t.plan(2);

    const tuple = await buildContextTuple([alice.id, carol.id], {
        now: new Date(Date.UTC(2026, 6, 28)),
    });

    t.match(tuple, /^\(.*\)$/, 'wrapped in parentheses');
    t.equal(
        tuple.split('),(').length,
        2,
        'two slots for two parties: arity must equal the policy count',
    );
});

t.test('a party with nothing to contribute still gets a slot', async t => {
    t.plan(1);
    // carol has no connections/groups, but date always contributes, so this
    // slot is never actually empty; the emitter's `()` path has its own test.
    const tuple = await buildContextTuple([carol.id], {
        now: new Date(Date.UTC(2026, 6, 28)),
    });

    t.match(
        tuple,
        /connections:\{\}/,
        'an empty collection, not a missing key',
    );
});

t.test('every context key documents itself', async t => {
    const keys = CONTEXT_PROVIDERS.flatMap(p => p.keys);
    t.plan(keys.length * 3 + 2);

    for (const key of keys) {
        t.ok(key.description.length > 0, `${key.name} has a description`);
        t.ok(key.example.length > 0, `${key.name} has an example`);
        t.ok(
            key.example.includes(key.name),
            `${key.name}'s example mentions its own key`,
        );
    }

    const examples = keys.map(k => k.example);
    t.equal(new Set(examples).size, examples.length, 'no example is reused');

    const descriptions = CONTEXT_PROVIDERS.find(
        p => p.name === 'date',
    )!.keys.map(k => k.description);
    t.notOk(
        descriptions.some(d => d.includes('no date type')),
        'the "Bart has no date type" sentence is gone',
    );
});
