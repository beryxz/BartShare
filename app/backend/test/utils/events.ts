'use strict';

import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootDb } from '../support/api-harness';
import { LogEvent, User } from '../../src/models/models';
import { logEvent } from '../../src/utils/events.utils';

let dbInstance: Sequelize;

t.before(async () => {
    dbInstance = await bootDb();
});
t.after(async () => {
    await dbInstance.close();
});

t.test('logEvent creates a row with correct fields', async t => {
    t.plan(4);

    await logEvent('test::create', null);

    const row = await LogEvent.findOne({ where: { type: 'test::create' } });
    t.not(row, null, 'row exists');
    t.equal(row!.type, 'test::create', 'type matches');
    t.equal(row!.UserId, null, 'UserId is null');
    t.match(
        row!.occurred_at,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        'occurred_at is ISO 8601',
    );

    await LogEvent.destroy({ where: { type: 'test::create' } });
});

t.test('logEvent links the row to the user', async t => {
    t.plan(2);

    const user = await User.create({
        attrs: { username: 'events-user' },
        rules: [],
    });
    t.teardown(() => user.destroy());

    await logEvent('test::user', user.id);

    const row = await LogEvent.findOne({ where: { type: 'test::user' } });
    t.not(row, null, 'row exists');
    t.equal(row!.UserId, user.id, 'UserId matches');

    await LogEvent.destroy({ where: { type: 'test::user' } });
});

t.test('logEvent does not throw on validation error', async t => {
    t.plan(1);

    // An empty string fails the len:[1,256] validation this swallows.
    await t.resolves(logEvent(''));
});

t.test('logEvent persists data payload', async t => {
    t.plan(2);

    await logEvent('test::data', null, { key: 'value' });

    const row = await LogEvent.findOne({ where: { type: 'test::data' } });
    t.not(row, null, 'row exists');
    t.match(row!.data, { key: 'value' }, 'data matches');

    await LogEvent.destroy({ where: { type: 'test::data' } });
});
