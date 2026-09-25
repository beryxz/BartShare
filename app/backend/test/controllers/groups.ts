'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import { Group, User } from '../../src/models/models';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let member: User;
let stranger: User;
let groupA: Group;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    member = await User.create({ attrs: { username: 'member' }, rules: [] });
    stranger = await User.create({
        attrs: { username: 'stranger' },
        rules: [],
    });
    groupA = await Group.create({ name: 'algebra', description: 'algebra' });
    await member.addGroup(groupA);
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('get all groups', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/groups',
    });
    t.equal(response.statusCode, 200, 'status code');
    t.ok(
        response.json().data.some((g: { id: string }) => g.id === groupA.id),
        'group is listed',
    );
});

t.test('get all groups: name filter', async t => {
    t.plan(2);

    // 'gebr' is an interior substring of 'algebra', not a prefix: it
    // distinguishes a real substring match from prefix-only matching.
    let response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/groups?name=gebr',
    });
    t.equal(response.json().data.length, 1, 'substring matches');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/groups?name=zzzz',
    });
    t.equal(response.json().data.length, 0, 'no match');
});

t.test('get one group', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/groups/${groupA.id}`,
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().name, 'algebra', 'name');
});

t.test('get one group: unknown id', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/groups/00000000-0000-0000-0000-000000000000',
    });
    t.equal(response.statusCode, 404, 'status code');
});

t.test('create a group auto-joins the creator', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/groups',
        cookies: { user: stranger.id },
        payload: { name: 'geometry', description: 'geometry' },
    });
    t.equal(response.statusCode, 201, 'status code');

    const created = await Group.findByPk(response.json().id);
    t.ok(await stranger.hasGroup(created!), 'creator is a member');

    // and being a member is what lets them edit it
    const patch = await apiServer.inject({
        method: 'PATCH',
        url: `/api/v1/groups/${created!.id}`,
        cookies: { user: stranger.id },
        payload: { description: 'euclidean geometry' },
    });
    t.equal(patch.statusCode, 200, 'creator can edit');

    await created!.destroy({ force: true });
});

t.test('create a group: unauthenticated', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/groups',
        payload: { name: 'geometry', description: 'geometry' },
    });
    t.equal(response.statusCode, 401, 'status code');
});

t.test('patch a group: member succeeds', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'PATCH',
        url: `/api/v1/groups/${groupA.id}`,
        cookies: { user: member.id },
        payload: { description: 'linear algebra' },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().description, 'linear algebra', 'description');
});

t.test('patch a group: non-member is forbidden', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'PATCH',
        url: `/api/v1/groups/${groupA.id}`,
        cookies: { user: stranger.id },
        payload: { name: 'hijacked' },
    });
    t.equal(response.statusCode, 403, 'status code');
    t.same(response.json(), { errors: ['Not authorized'] }, 'body');
});

t.test('patch a group: unknown id is a 404, not a 403', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'PATCH',
        url: '/api/v1/groups/00000000-0000-0000-0000-000000000000',
        cookies: { user: member.id },
        payload: { name: 'ghost' },
    });
    t.equal(response.statusCode, 404, 'status code');
});

t.test('delete a group: non-member is forbidden', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/groups/${groupA.id}`,
        cookies: { user: stranger.id },
    });
    t.equal(response.statusCode, 403, 'status code');
});

t.test('delete a group: member succeeds', async t => {
    t.plan(2);

    const doomed = await Group.create({ name: 'doomed', description: 'x' });
    await member.addGroup(doomed);

    const response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/groups/${doomed.id}`,
        cookies: { user: member.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(await Group.findByPk(doomed.id), null, 'row is gone');
});

t.test('get all groups: ordering is deterministic', async t => {
    t.plan(1);

    // Two groups sharing a name: without an id tiebreaker their relative order
    // is undefined, which lets offset paging repeat or skip a row.
    await Group.create({ name: 'duplicate', description: 'first' });
    await Group.create({ name: 'duplicate', description: 'second' });

    const first = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/groups?name=duplicate',
    });
    const second = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/groups?name=duplicate',
    });
    t.same(
        first.json().data.map((g: { id: string }) => g.id),
        second.json().data.map((g: { id: string }) => g.id),
        'identical ordering across identical requests',
    );
});
