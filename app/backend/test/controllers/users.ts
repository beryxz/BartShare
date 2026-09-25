'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import { User } from '../../src/models/models';
import { withFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let userA: User;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    userA = await User.create({
        attrs: { username: 'student-user', role: 'student' },
        rules: [],
    });
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('get all users', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users',
    });
    t.equal(response.statusCode, 200, 'status code');

    const body = response.json();
    t.ok(Array.isArray(body.data), 'data is an array');
    t.equal(body.page.number, 1, 'pages are 1-indexed');
});

t.test('get all users keeps attrs contents', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users',
    });
    const found = response
        .json()
        .data.find((user: { id: string }) => user.id === userA.id);
    // guards against fast-json-stringify silently stripping the free-form object
    t.same(
        found.attrs,
        { username: 'student-user', role: 'student' },
        'attrs survive serialization',
    );
});

t.test('get one user', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/users/${userA.id}`,
    });
    t.equal(response.statusCode, 200, 'status code');
    t.matchOnly(
        response.json(),
        {
            id: userA.id,
            attrs: { username: 'student-user', role: 'student' },
            rules: [],
        },
        'body',
    );
});

t.test('get one user: unknown id', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users/00000000-0000-0000-0000-000000000000',
    });
    t.equal(response.statusCode, 404, 'status code');
});

t.test('get one user: malformed id', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users/not-a-uuid',
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('create a user', async t => {
    t.plan(3);

    const response = await withFakeEvaluator(
        () => ({ valid: true }),
        () =>
            apiServer.inject({
                method: 'POST',
                url: '/api/v1/users',
                payload: {
                    attrs: { username: 'teacher-user', role: 'teacher' },
                },
            }),
    );
    t.equal(response.statusCode, 201, 'status code');

    const body = response.json();
    t.same(body.rules, [], 'rules default to an empty array');
    t.same(
        body.attrs,
        { username: 'teacher-user', role: 'teacher' },
        'attrs are stored',
    );

    await User.destroy({ where: { id: body.id } });
});

t.test('create a user: missing attrs', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {},
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('create user: a reserved attrs key is rejected', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { attrs: { userId: 'spoofed' } },
    });
    t.equal(response.statusCode, 400, 'status code');
    t.match(response.json().errors[0], /reserved/, 'names the problem');
});

t.test('create user: an invalid attrs key is rejected', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { attrs: { 'a.b': 'x' } },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('create a user: a duplicate username is rejected', async t => {
    t.plan(2);

    // The first POST is a success and therefore reaches the evaluator; the second is
    // rejected by the uniqueness check before it gets there. One fake covers both.
    await withFakeEvaluator(
        () => ({ valid: true }),
        async () => {
            const first = await apiServer.inject({
                method: 'POST',
                url: '/api/v1/users',
                payload: { attrs: { username: 'duplicate-me' } },
            });
            t.equal(first.statusCode, 201, 'the first one is created');

            const second = await apiServer.inject({
                method: 'POST',
                url: '/api/v1/users',
                payload: { attrs: { username: 'duplicate-me' } },
            });
            t.equal(second.statusCode, 400, 'the second one is rejected');
        },
    );
});

t.test('create a user: a missing username is rejected', async t => {
    t.plan(1);

    // A missing username is caught by the model validator on `User.create`, which runs
    // *after* the policy validation -- so this request does reach the evaluator.
    const response = await withFakeEvaluator(
        () => ({ valid: true }),
        () =>
            apiServer.inject({
                method: 'POST',
                url: '/api/v1/users',
                payload: { attrs: { studyLevel: 'undergraduate' } },
            }),
    );
    t.equal(response.statusCode, 400, 'status code');
});

t.test('get all users: username filter', async t => {
    t.plan(2);

    const rememberedUser = await User.create({
        attrs: { username: 'remembered' },
        rules: [],
    });

    let response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users?username=ember',
    });
    t.ok(
        response.json().data.length >= 1 &&
            response
                .json()
                .data.every((u: { attrs: { username: string } }) =>
                    u.attrs.username.includes('ember'),
                ),
        'every returned user matches the interior substring',
    );

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users?username=zzzz',
    });
    t.equal(response.json().data.length, 0, 'no match');

    await User.destroy({ where: { id: rememberedUser.id } });
});

t.test('create a user: username is stored and queried trimmed', async t => {
    t.plan(3);

    const first = await withFakeEvaluator(
        () => ({ valid: true }),
        () =>
            apiServer.inject({
                method: 'POST',
                url: '/api/v1/users',
                payload: { attrs: { username: 'bob' } },
            }),
    );
    t.equal(first.statusCode, 201, 'the first one is created');
    t.equal(
        first.json().attrs.username,
        'bob',
        'stored with no surrounding whitespace',
    );

    // "bob " must collide with the stored "bob": both the uniqueness check
    // and the write see the trimmed value, detected before policy validation.
    const second = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { attrs: { username: 'bob ' } },
    });
    t.equal(second.statusCode, 400, 'the padded duplicate is rejected too');

    await User.destroy({ where: { id: first.json().id } });
});
