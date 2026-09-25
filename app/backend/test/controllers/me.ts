'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import { Group, Resource, User } from '../../src/models/models';
import { withFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let userA: User;
let userB: User;
let groupA: Group;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    userA = await User.create({ attrs: { username: 'user-a' }, rules: [] });
    userB = await User.create({ attrs: { username: 'user-b' }, rules: [] });
    groupA = await Group.create({ name: 'algebra', description: 'algebra' });
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('get user information', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me',
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.matchOnly(
        response.json(),
        { id: String, attrs: Object, rules: Array },
        'body',
    );
});

t.test('auth: unauthenticated is blocked', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me',
    });
    t.equal(response.statusCode, 401, 'GET /me status code');
});

t.test('patch me', async t => {
    t.plan(2);

    const response = await withFakeEvaluator(
        () => ({ valid: true }),
        () =>
            apiServer.inject({
                method: 'PATCH',
                url: '/api/v1/me',
                cookies: { user: userA.id },
                payload: { attrs: { username: 'user-a', city: 'pisa' } },
            }),
    );
    t.equal(response.statusCode, 200, 'status code');
    t.same(
        response.json().attrs,
        { username: 'user-a', city: 'pisa' },
        'attrs replaced',
    );
});

t.test('patch me: rules are left untouched when omitted', async t => {
    t.plan(1);

    // Seeded directly through the model, skipping PATCH /me's grammar
    // validation, with a non-empty value so a PATCH that resets rules to []
    // can't pass as one that correctly leaves it alone.
    await userA.update({ rules: ['some-rule'] });

    await withFakeEvaluator(
        () => ({ valid: true }),
        async () => {
            const response = await apiServer.inject({
                method: 'PATCH',
                url: '/api/v1/me',
                cookies: { user: userA.id },
                payload: { attrs: { username: 'user-a' } },
            });
            t.same(response.json().rules, ['some-rule'], 'rules unchanged');

            // restore the fixture so later subtests see userA as originally created
            await apiServer.inject({
                method: 'PATCH',
                url: '/api/v1/me',
                cookies: { user: userA.id },
                payload: { attrs: { username: 'user-a' }, rules: [] },
            });
        },
    );
});

t.test('get my resources', async t => {
    t.plan(3);

    const resource = await Resource.create({
        attrs: { kind: 'note' },
        metadata: { name: 'Notes' },
        UserId: userA.id,
    });
    t.teardown(() => resource.destroy({ force: true }));

    const otherResource = await Resource.create({
        attrs: { kind: 'note' },
        metadata: { name: 'Notes' },
        UserId: userB.id,
    });
    t.teardown(() => otherResource.destroy({ force: true }));

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/resources',
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().data.length, 1, 'only own resources');
    t.same(
        response.json().data.map((r: { id: string }) => r.id),
        [resource.id],
        'contains only userA resource, not userB resource',
    );
});

t.test('connections are mutual', async t => {
    t.plan(4);

    let response = await apiServer.inject({
        method: 'POST',
        url: `/api/v1/me/connections/${userB.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 204, 'connect status code');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/connections',
        cookies: { user: userA.id },
    });
    t.equal(response.json().data[0].id, userB.id, 'A sees B');

    // the reciprocal row is what makes the connection mutual
    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/connections',
        cookies: { user: userB.id },
    });
    t.equal(response.json().data[0].id, userA.id, 'B sees A');

    response = await apiServer.inject({
        method: 'POST',
        url: `/api/v1/me/connections/${userB.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 409, 'connecting twice conflicts');
});

t.test('disconnect removes both directions', async t => {
    t.plan(3);

    let response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/me/connections/${userB.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 204, 'status code');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/connections',
        cookies: { user: userB.id },
    });
    t.equal(response.json().data.length, 0, 'B no longer sees A');

    response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/me/connections/${userB.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 404, 'disconnecting twice is a 404');
});

t.test('cannot connect to self', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: `/api/v1/me/connections/${userA.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('join and leave a group', async t => {
    t.plan(4);

    let response = await apiServer.inject({
        method: 'POST',
        url: `/api/v1/me/groups/${groupA.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 204, 'join status code');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/groups',
        cookies: { user: userA.id },
    });
    t.equal(response.json().data[0].id, groupA.id, 'group is listed');

    response = await apiServer.inject({
        method: 'POST',
        url: `/api/v1/me/groups/${groupA.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 409, 'joining twice conflicts');

    response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/me/groups/${groupA.id}`,
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 204, 'leave status code');
});

t.test('join a group: unknown id', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/me/groups/00000000-0000-0000-0000-000000000000',
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 404, 'status code');
});

t.test('delete me cascades', async t => {
    t.plan(5);

    const victim = await User.create({
        attrs: { username: 'victim' },
        rules: [],
    });
    const resource = await Resource.create({
        attrs: { kind: 'note' },
        metadata: { name: 'Notes' },
        UserId: victim.id,
    });
    await apiServer.inject({
        method: 'POST',
        url: `/api/v1/me/connections/${userA.id}`,
        cookies: { user: victim.id },
    });
    await apiServer.inject({
        method: 'POST',
        url: `/api/v1/me/groups/${groupA.id}`,
        cookies: { user: victim.id },
    });

    // the victim must actually be linked to userA before we prove the link is removed
    const before = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/connections',
        cookies: { user: userA.id },
    });
    t.ok(
        before.json().data.some((u: { id: string }) => u.id === victim.id),
        'userA is linked to the victim before deletion',
    );

    const response = await apiServer.inject({
        method: 'DELETE',
        url: '/api/v1/me',
        cookies: { user: victim.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(await User.findByPk(victim.id), null, 'user is gone');
    t.equal(await Resource.findByPk(resource.id), null, 'resources are gone');

    // the mirrored row (victim -> userA) must go too, or userA keeps a dangling link
    const connections = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/connections',
        cookies: { user: userA.id },
    });
    t.notOk(
        connections.json().data.some((u: { id: string }) => u.id === victim.id),
        'mirrored connection is gone',
    );
});

t.test('patch me: keeping your own username is allowed', async t => {
    t.plan(1);

    const response = await withFakeEvaluator(
        () => ({ valid: true }),
        () =>
            apiServer.inject({
                method: 'PATCH',
                url: '/api/v1/me',
                cookies: { user: userA.id },
                payload: { attrs: { username: 'user-a', extra: 'x' } },
            }),
    );
    t.equal(response.statusCode, 200, 'status code');
});

t.test(
    'patch me: a padded username colliding with another is rejected',
    async t => {
        t.plan(1);

        // "user-a " trims to userA's own username -- the query has to normalise it too,
        // not just the write, or this padded collision would slip through.
        const response = await apiServer.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            cookies: { user: userB.id },
            payload: { attrs: { username: 'user-a ' } },
        });
        t.equal(response.statusCode, 400, 'status code');
    },
);

t.test('my resources embed the owner', async t => {
    t.plan(2);

    const resource = await Resource.create({
        attrs: { kind: 'note' },
        metadata: { name: 'Notes' },
        UserId: userA.id,
    });
    t.teardown(() => resource.destroy({ force: true }));

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/resources',
        cookies: { user: userA.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().data[0].user.id, userA.id, 'owner is embedded');
});

t.test('get my resources: name and attr filters', async t => {
    t.plan(3);

    await Resource.create({
        attrs: { topic: ['algebra', 'calculus'] },
        metadata: { name: 'my algebra notes' },
        UserId: userA.id,
    });

    let response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/resources?name=ebra',
        cookies: { user: userA.id },
    });
    t.equal(response.json().data.length, 1, 'name filter');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/resources?attr=topic:calculus',
        cookies: { user: userA.id },
    });
    t.equal(response.json().data.length, 1, 'attr filter matches array member');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/resources?attr=topic:nothing',
        cookies: { user: userA.id },
    });
    t.equal(response.json().data.length, 0, 'attr filter with no match');
});

t.test('get my groups and connections: filters', async t => {
    t.plan(2);

    let response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/groups?name=zzzz',
        cookies: { user: userA.id },
    });
    t.equal(response.json().data.length, 0, 'group name filter with no match');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/connections?username=zzzz',
        cookies: { user: userA.id },
    });
    t.equal(
        response.json().data.length,
        0,
        'connection username filter with no match',
    );
});

t.test('patch me: an attrs-only patch is still validated', async t => {
    t.plan(2);
    // An attrs-only patch can still make the assembled policy unparseable, so
    // revalidation must run on any change, not only when `rules` is present.
    const validated: string[] = [];
    const response = await withFakeEvaluator(
        body => {
            validated.push(body);
            return { valid: true };
        },
        () =>
            apiServer.inject({
                method: 'PATCH',
                url: '/api/v1/me',
                cookies: { user: userA.id },
                payload: { attrs: { username: 'user-a', score: 1 } },
            }),
    );

    t.equal(response.statusCode, 200, 'status code');
    t.equal(validated.length, 1, 'the assembled policy reached the evaluator');
});
