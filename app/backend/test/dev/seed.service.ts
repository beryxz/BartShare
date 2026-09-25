'use strict';

import { Sequelize } from 'sequelize';
import t from 'tap';
import config from '../../src/config';
import { scenarioById } from '../../src/dev/scenarios';
import {
    isDatabaseEmpty,
    listScenarios,
    resetDatabase,
    seedScenario,
} from '../../src/dev/seed.service';
import { Group, LogEvent, Resource, User } from '../../src/models/models';
import { logEvent } from '../../src/utils/events.utils';
import { bootDb } from '../support/api-harness';
import { withFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;

t.before(async () => {
    dbInstance = await bootDb();
});
t.after(async () => {
    await dbInstance.close();
});

t.test('listScenarios describes the catalogue', async t => {
    const list = listScenarios();
    t.same(
        list.map(s => s.id),
        ['ex1', 'ex2', 'ex3', 'ex4', 'ex5'],
        'ids in catalogue order',
    );
    t.same(
        list.find(s => s.id === 'ex3')?.counts,
        { users: 3, resources: 3, connections: 1, groups: 0 },
        'counts come from the fixture',
    );
});

t.test('a fresh schema is empty', async t => {
    t.equal(await isDatabaseEmpty(), true, 'no users and no groups');
});

t.test('a lone group makes the database non-empty', async t => {
    const group = await Group.create({ name: 'leftover', description: 'd' });
    t.equal(await isDatabaseEmpty(), false, 'groups count as data');
    await group.destroy();
    t.equal(await isDatabaseEmpty(), true, 'and back to empty');
});

t.test(
    'seeding ex3 writes parties, resources and one mutual connection',
    async t => {
        const created = await withFakeEvaluator(
            () => ({ valid: true }),
            () => seedScenario(dbInstance, scenarioById('ex3')!),
        );

        t.same(
            created,
            { users: 3, resources: 3, connections: 1, groups: 0 },
            'reported counts',
        );
        t.equal(await User.count(), 3, 'three parties');
        t.equal(await Resource.count(), 3, 'three resources');
        t.equal(await isDatabaseEmpty(), false, 'no longer empty');

        // Found in JS, not a JSONB where clause: whereJsonSubstring is a
        // substring match built for search, not an equality lookup.
        const all = await User.findAll();
        const by = (username: string) =>
            all.find(u => u.attrs.username === username)!;
        const john = by('john');
        const david = by('david');

        t.equal(
            await john.hasConnection(david),
            true,
            'john is connected to david',
        );
        t.equal(
            await david.hasConnection(john),
            true,
            'and the connection is mutual',
        );

        const owned = await Resource.count({
            where: { UserId: by('mary').id },
        });
        t.equal(owned, 1, 'resources are attached to their fixture owner');

        // Leave the schema empty for the next subtest.
        await Resource.destroy({ where: {} });
        await User.destroy({ where: {} });
    },
);

t.test('an unreachable evaluator leaves the database untouched', async t => {
    const previousUrl = config.EVALUATOR_URL;
    config.EVALUATOR_URL = 'http://127.0.0.1:1';

    await t.rejects(
        seedScenario(dbInstance, scenarioById('ex1')!),
        'the evaluator failure propagates',
    );
    t.equal(await User.count(), 0, 'nothing was written');

    config.EVALUATOR_URL = previousUrl;
});

t.test('a fixture the evaluator rejects is a FixtureInvalidError', async t => {
    await t.rejects(
        withFakeEvaluator(
            () => ({
                valid: false,
                error: { line: 1, column: 4, message: 'no viable alternative' },
            }),
            () => seedScenario(dbInstance, scenarioById('ex1')!),
        ),
        { name: 'FixtureInvalidError' },
        'named so the controller can answer 500 rather than 400',
    );
    t.equal(await User.count(), 0, 'and nothing was written');
});

t.test('reset empties every table, join tables included', async t => {
    await withFakeEvaluator(
        () => ({ valid: true }),
        () => seedScenario(dbInstance, scenarioById('ex3')!),
    );
    const group = await Group.create({ name: 'study', description: 'd' });
    const someone = await User.findOne();
    await someone!.addGroup(group);
    await logEvent('test.event', someone!.id);

    const deleted = await resetDatabase(dbInstance);

    t.same(
        deleted,
        { users: 3, resources: 3, groups: 1, logEvents: 1 },
        'counts describe what was there',
    );
    t.equal(await User.count(), 0, 'users');
    t.equal(await Resource.count(), 0, 'resources');
    t.equal(await Group.count(), 0, 'groups');
    t.equal(await LogEvent.count(), 0, 'log events');

    // The join tables are string `through` targets, not models this file
    // imports, so they're queried directly: a missed CASCADE would leave
    // dangling rows here that every later seed would inherit.
    const [connections] = await dbInstance.query(
        'SELECT count(*)::int AS n FROM "UserConnections"',
    );
    const [memberships] = await dbInstance.query(
        'SELECT count(*)::int AS n FROM "UserGroups"',
    );
    t.equal((connections[0] as { n: number }).n, 0, 'UserConnections');
    t.equal((memberships[0] as { n: number }).n, 0, 'UserGroups');
});

t.test('reset on an empty database is a no-op with zero counts', async t => {
    t.same(
        await resetDatabase(dbInstance),
        { users: 0, resources: 0, groups: 0, logEvents: 0 },
        'idempotent, never an error',
    );
});
