'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import { Resource, User } from '../../src/models/models';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let owner: User;
let otherOwner: User;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    owner = await User.create({
        attrs: { username: 'facet-owner' },
        rules: [],
    });
    await Resource.create({
        attrs: { topic: ['algebra', 'calculus'], kind: 'notes' },
        metadata: { name: 'facet algebra' },
        UserId: owner.id,
    });
    await Resource.create({
        attrs: { kind: 'exercises', userId: 'should-be-excluded' },
        metadata: { name: 'facet exercises' },
        UserId: owner.id,
    });
    await Resource.create({
        attrs: { year: 2023 },
        metadata: { name: 'facet dated' },
        UserId: owner.id,
    });

    // A second owner with a key nobody else uses, so "did the owner filter
    // actually apply?" is answerable from the response body alone.
    otherOwner = await User.create({
        attrs: { username: 'facet-other-owner' },
        rules: [],
    });
    await Resource.create({
        attrs: { theirsOnly: 'yes' },
        metadata: { name: 'facet foreign' },
        UserId: otherOwner.id,
    });

    // A party carrying a scalar, an array and a reserved key, so one response
    // answers all three questions the endpoint has to get right.
    await User.create({
        attrs: {
            username: 'facet-party',
            role: 'auditor',
            tags: ['beta', 'alpha'],
            userId: 'should-be-excluded',
        },
        rules: [],
    });
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

type Facet = { key: string; values: string[] };

t.test('resource facets', async t => {
    t.plan(4);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources/facets',
    });
    t.equal(response.statusCode, 200, 'status code');

    const facets: Facet[] = response.json().facets;
    const kind = facets.find(f => f.key === 'kind');
    const topic = facets.find(f => f.key === 'topic');

    t.same(kind?.values, ['exercises', 'notes'], 'scalar values, sorted');
    // Array members are expanded, so a chip exists per member rather than one
    // chip holding the raw JSON array.
    t.same(topic?.values, ['algebra', 'calculus'], 'array members expanded');
    // `userId` is injected by the system and must never be offered as a filter.
    t.equal(
        facets.find(f => f.key === 'userId'),
        undefined,
        'reserved keys excluded',
    );
});

t.test('resource facets honour the filters', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources/facets?attr=kind:exercises',
    });
    const facets: Facet[] = response.json().facets;
    t.equal(
        facets.find(f => f.key === 'topic'),
        undefined,
        'a key only present on excluded rows disappears',
    );
});

// The tests below assert on facet content, not status code: both
// endpoints answer 200 either way, so status alone misses a deleted filter.

t.test('me resource facets are scoped to the caller', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/resources/facets',
        cookies: { user: owner.id },
    });
    t.equal(response.statusCode, 200, 'status code');

    const facets: Facet[] = response.json().facets;
    t.ok(
        facets.find(f => f.key === 'kind'),
        'my own keys are present',
    );
    // Without the ownerId scope, chips would come from every row and match
    // none of my resources, so clicking one would empty my own list.
    t.equal(
        facets.find(f => f.key === 'theirsOnly'),
        undefined,
        "another owner's keys are excluded",
    );
});

t.test('resource facets honour excludeUserId', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/facets?excludeUserId=${otherOwner.id}`,
    });

    const facets: Facet[] = response.json().facets;
    t.equal(
        facets.find(f => f.key === 'theirsOnly'),
        undefined,
        "the excluded owner's keys are gone",
    );
    t.ok(
        facets.find(f => f.key === 'kind'),
        'everyone else survives',
    );
});

t.test('resource facets honour a name filter', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources/facets?name=algebra',
    });

    const facets: Facet[] = response.json().facets;
    t.ok(
        facets.find(f => f.key === 'topic'),
        'the matching row contributes its keys',
    );
    t.equal(
        facets.find(f => f.key === 'year'),
        undefined,
        'a key only present on non-matching rows disappears',
    );
});

t.test('resource facets honour a typed (numeric) attr filter', async t => {
    t.plan(2);

    // GET /resources probes a numeric-looking value as both string and number
    // form; the facet endpoint must agree, or its own chip becomes unusable.
    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources/facets?attr=year:2023',
    });
    t.equal(response.statusCode, 200, 'status code');

    const facets: Facet[] = response.json().facets;
    t.same(
        facets.find(f => f.key === 'year')?.values,
        ['2023'],
        'the facet endpoint agrees with the list endpoint on a numeric attr',
    );
});

t.test('user facets', async t => {
    t.plan(5);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users/facets',
    });
    t.equal(response.statusCode, 200, 'status code');

    const facets: Facet[] = response.json().facets;
    t.same(
        facets.find(f => f.key === 'role')?.values,
        ['auditor'],
        'scalar values',
    );
    t.same(
        facets.find(f => f.key === 'tags')?.values,
        ['alpha', 'beta'],
        'array members expanded and sorted',
    );
    t.same(
        facets.find(f => f.key === 'username')?.values,
        ['facet-other-owner', 'facet-owner', 'facet-party'],
        'every party contributes',
    );
    // `userId` is what the system injects to name a party; a list of uuids is
    // not a useful suggestion and the key must never be offered.
    t.equal(
        facets.find(f => f.key === 'userId'),
        undefined,
        'reserved keys excluded',
    );
});

t.test('user facets honour the username filter', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users/facets?username=party',
    });
    const facets: Facet[] = response.json().facets;
    t.same(
        facets.find(f => f.key === 'role')?.values,
        ['auditor'],
        'the matching party is included',
    );
    t.same(
        facets.find(f => f.key === 'username')?.values,
        ['facet-party'],
        'non-matching parties are excluded',
    );
});

// `/users/facets` must be registered before `/users/:userId`, or Fastify
// matches "facets" as a userId and the uuid format check answers 400.
t.test('user facets are not shadowed by the :userId route', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/users/facets',
    });
    t.equal(response.statusCode, 200, 'not a 400 from the uuid param check');
});
