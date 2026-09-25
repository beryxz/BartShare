'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import { Resource, User } from '../../src/models/models';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let owner: User;
let stranger: User;
let resourceA: Resource;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    owner = await User.create({ attrs: { username: 'owner' }, rules: [] });
    stranger = await User.create({
        attrs: { username: 'stranger' },
        rules: [],
    });
    resourceA = await Resource.create({
        attrs: { kind: 'note' },
        metadata: { name: 'Resource A' },
        UserId: owner.id,
    });
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('get all resources embeds the owner', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources',
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().data[0].user.id, owner.id, 'owner is embedded');
});

t.test('get one resource', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}`,
    });
    t.equal(response.statusCode, 200, 'status code');
    t.same(response.json().attrs, { kind: 'note' }, 'attrs');
});

t.test('get one resource: unknown id', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources/00000000-0000-0000-0000-000000000000',
    });
    t.equal(response.statusCode, 404, 'status code');
});

t.test('create a resource', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/resources',
        cookies: { user: owner.id },
        payload: { attrs: { kind: 'photo' }, metadata: { name: 'Photo' } },
    });
    t.equal(response.statusCode, 201, 'status code');

    const created = await Resource.findByPk(response.json().id);
    t.equal(created!.UserId, owner.id, 'owned by the caller');
    await created!.destroy({ force: true });
});

t.test('create a resource: unauthenticated', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/resources',
        payload: { attrs: { kind: 'photo' }, metadata: { name: 'Photo' } },
    });
    t.equal(response.statusCode, 401, 'status code');
});

t.test('create a resource: empty attrs is rejected', async t => {
    t.plan(1);

    // the model requires at least one attribute
    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/resources',
        cookies: { user: owner.id },
        payload: { attrs: {}, metadata: { name: 'Photo' } },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('create resource: a reserved attrs key is rejected', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/resources',
        cookies: { user: owner.id },
        payload: {
            attrs: { connections: [] },
            metadata: { name: 'Photo' },
        },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('a resource carries metadata and a null content block', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}`,
    });
    const body = response.json();

    t.equal(response.statusCode, 200, 'status code');
    t.equal(body.metadata.name, 'Resource A', 'metadata is returned');
    t.equal(body.content, null, 'no content uploaded yet');
});

t.test('create a resource: metadata is required', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/resources',
        cookies: { user: owner.id },
        payload: { attrs: { kind: 'photo' } },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('patch a resource: metadata alone, without attrs', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'PATCH',
        url: `/api/v1/resources/${resourceA.id}`,
        cookies: { user: owner.id },
        payload: { metadata: { name: 'Renamed' } },
    });
    const body = response.json();

    t.equal(response.statusCode, 200, 'status code');
    t.equal(body.metadata.name, 'Renamed', 'metadata replaced');
    t.same(body.attrs, { kind: 'note' }, 'attrs untouched');

    await resourceA.reload();
});

t.test('patch a resource: an empty body is rejected', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'PATCH',
        url: `/api/v1/resources/${resourceA.id}`,
        cookies: { user: owner.id },
        payload: {},
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test(
    'patch a resource: owner replaces attrs wholesale, not merged',
    async t => {
        t.plan(2);

        // resourceA starts as { kind: 'note' }; the payload omits `kind`, so a
        // deep merge would still carry it over, which t.same would catch.
        const response = await apiServer.inject({
            method: 'PATCH',
            url: `/api/v1/resources/${resourceA.id}`,
            cookies: { user: owner.id },
            payload: { attrs: { shared: true } },
        });
        t.equal(response.statusCode, 200, 'status code');
        t.same(response.json().attrs, { shared: true }, 'attrs replaced');
    },
);

t.test('patch a resource: non-owner is forbidden', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'PATCH',
        url: `/api/v1/resources/${resourceA.id}`,
        cookies: { user: stranger.id },
        payload: { attrs: { kind: 'hijacked' } },
    });
    t.equal(response.statusCode, 403, 'status code');
    t.same(response.json(), { errors: ['Not authorized'] }, 'body');
});

t.test('delete a resource: non-owner is forbidden', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/resources/${resourceA.id}`,
        cookies: { user: stranger.id },
    });
    t.equal(response.statusCode, 403, 'status code');
});

t.test('delete a resource: owner succeeds', async t => {
    t.plan(2);

    const doomed = await Resource.create({
        attrs: { kind: 'draft' },
        metadata: { name: 'Draft' },
        UserId: owner.id,
    });

    const response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/resources/${doomed.id}`,
        cookies: { user: owner.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(await Resource.findByPk(doomed.id), null, 'row is gone');
});

t.test('get all resources: name, attr and excludeUserId filters', async t => {
    t.plan(6);

    const other = await User.create({
        attrs: { username: 'filter-other' },
        rules: [],
    });
    // 'ebra' is deliberately an interior substring, not a prefix, so a filter
    // narrowed to `ILIKE 'value%'` would fail this.
    await Resource.create({
        attrs: { topic: ['algebra', 'calculus'], year: 2023 },
        metadata: { name: 'algebra sheet' },
        UserId: other.id,
    });
    await Resource.create({
        attrs: { topic: 'physics' },
        metadata: { name: 'physics sheet' },
        UserId: other.id,
    });

    let response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources?name=ebra',
    });
    t.equal(
        response.json().data.length,
        1,
        'name matches an interior substring',
    );

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources?name=zzzz',
    });
    t.equal(response.json().data.length, 0, 'name with no match');

    // The array case: `topic` holds ["algebra","calculus"], and a scalar probe
    // alone would not match it.
    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources?attr=topic:calculus',
    });
    t.equal(response.json().data.length, 1, 'attr matches an array member');

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources?attr=topic:physics',
    });
    t.equal(response.json().data.length, 1, 'attr matches a scalar');

    // The type-strictness case: the param is the string "2023", the stored
    // value is the number 2023.
    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources?attr=year:2023',
    });
    t.equal(response.json().data.length, 1, 'attr matches a numeric value');

    response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources?excludeUserId=${other.id}`,
    });
    t.ok(
        response
            .json()
            .data.every(
                (r: { user: { id: string } }) => r.user.id !== other.id,
            ),
        'excludeUserId drops that owner rows',
    );
});

t.test('get all resources: malformed attr matches nothing', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources?attr=nocolon',
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().data.length, 0, 'no colon matches no rows');
});

t.test(
    'get all resources: attr with an empty value matches nothing',
    async t => {
        t.plan(2);

        const response = await apiServer.inject({
            method: 'GET',
            url: '/api/v1/resources?attr=topic:',
        });
        t.equal(response.statusCode, 200, 'status code, not a 500');
        t.equal(response.json().data.length, 0, 'empty value matches no rows');
    },
);

t.test(
    'get all resources: a filter narrows the result set across a page boundary',
    async t => {
        t.plan(8);

        // The matching set (60) spans more than one page (size 50), so a
        // filter applied to rows but not the count would still show here.
        const pager = await User.create({
            attrs: { username: 'pager-owner' },
            rules: [],
        });
        const pageSize = 50;
        const matchingCount = 60;
        const otherCount = 10;

        await Resource.bulkCreate([
            ...Array.from({ length: matchingCount }, (_, i) => ({
                attrs: { pagerBatch: 'alpha' },
                metadata: { name: `pager alpha ${i}` },
                UserId: pager.id,
            })),
            ...Array.from({ length: otherCount }, (_, i) => ({
                attrs: { pagerBatch: 'beta' },
                metadata: { name: `pager beta ${i}` },
                UserId: pager.id,
            })),
        ]);

        let response = await apiServer.inject({
            method: 'GET',
            url: '/api/v1/resources?attr=pagerBatch:alpha',
        });
        let body = response.json();
        t.equal(response.statusCode, 200, 'status code, page 1');
        t.equal(
            body.page.totalElements,
            matchingCount,
            'totalElements tracks the filter, not the whole corpus',
        );
        t.equal(body.page.totalPages, 2, 'totalPages tracks the filter');
        t.equal(body.data.length, pageSize, 'page 1 is full');

        response = await apiServer.inject({
            method: 'GET',
            url: '/api/v1/resources?attr=pagerBatch:alpha&page=2',
        });
        body = response.json();
        t.equal(response.statusCode, 200, 'status code, page 2');
        t.equal(
            body.data.length,
            matchingCount - pageSize,
            'page 2 returns the remainder',
        );
        t.equal(
            body.page.totalElements,
            matchingCount,
            'totalElements is stable across pages',
        );
        t.ok(
            body.data.every(
                (r: { attrs: { pagerBatch?: string } }) =>
                    r.attrs.pagerBatch === 'alpha',
            ),
            'page 2 rows still match the filter',
        );
    },
);
