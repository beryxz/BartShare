'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import { Group, User } from '../../src/models/models';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let me: User;
let friend: User;
let group: Group;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    me = await User.create({ attrs: { username: 'ctx-me' }, rules: [] });
    friend = await User.create({
        attrs: { username: 'ctx-friend' },
        rules: [],
    });
    group = await Group.create({ name: 'ctx-group', description: 'd' });

    await me.addConnection(friend);
    await friend.addConnection(me);
    await me.addGroup(group);
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('values are the ids the engine matches on', async t => {
    t.plan(4);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/context',
        cookies: { user: me.id },
    });
    const body = response.json();

    t.equal(response.statusCode, 200, 'status code');
    t.same(body.values.connections, [friend.id], 'connections are uuids');
    t.same(body.values.groups, [group.id], 'groups are uuids');
    t.equal(
        typeof body.values.date_year,
        'number',
        'the clock is in there too',
    );
});

t.test('display resolves ids to names', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/context',
        cookies: { user: me.id },
    });
    const body = response.json();

    t.same(
        body.display.connections,
        [{ id: friend.id, username: 'ctx-friend' }],
        'usernames for humans, ids for the engine',
    );
    t.same(
        body.display.groups,
        [{ id: group.id, name: 'ctx-group' }],
        'group names',
    );
});

t.test('names self-describe every provider key', async t => {
    t.plan(4);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/context',
        cookies: { user: me.id },
    });
    const names: { key: string; example: string }[] = response.json().names;

    t.equal(
        names.length,
        5,
        'date_year, date_month, date_day, connections, groups',
    );
    t.ok(
        names.every(entry => entry.example.length > 0),
        'every name carries an example condition',
    );
    t.ok(
        names.some(entry => entry.key === 'connections'),
        'connections is described',
    );
    // Unqualified `groups` resolves to the policy owner, not the requester, so
    // the shipped example must use `requester.groups` to ask a useful question.
    t.match(
        names.find(entry => entry.key === 'groups')?.example,
        /requester\.groups/,
        'the groups example asks about the requester, not the owner',
    );
});

t.test('unauthenticated is a 401', async t => {
    t.plan(1);
    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/context',
    });
    t.equal(response.statusCode, 401, 'status code');
});
