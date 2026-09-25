'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import { Resource, User } from '../../src/models/models';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let owner: User;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    owner = await User.create({ attrs: { username: 'cov-owner' }, rules: [] });
    await Resource.create({
        attrs: { kind: 'notes' },
        metadata: { name: 'notes one' },
        UserId: owner.id,
    });
    await Resource.create({
        attrs: { kind: 'notes' },
        metadata: { name: 'notes two' },
        UserId: owner.id,
    });
    await Resource.create({
        attrs: { kind: 'exercises' },
        metadata: { name: 'exercise one' },
        UserId: owner.id,
    });
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('rule coverage', async t => {
    t.plan(6);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/me/rules/coverage',
        cookies: { user: owner.id },
        payload: {
            patterns: [
                { kind: 'notes' },
                { kind: 'exercises' },
                {},
                { kind: 'nothing' },
            ],
        },
    });

    t.equal(response.statusCode, 200, 'status code');
    const body = response.json();

    // total counts the caller's whole corpus, independent of any page size.
    t.equal(body.total, 3, 'total is every resource the caller owns');

    t.equal(body.coverage[0].count, 2, 'pattern 0 covers both notes');
    t.equal(body.coverage[1].count, 1, 'pattern 1 covers the exercise');
    // matches(resource.attrs, pattern) requires every resource attribute to be
    // restated by the pattern, so {} covers only an attribute-less resource;
    // a swapped argument order would flip this count from 0 to 3.
    t.equal(body.coverage[2].count, 0, 'an empty pattern covers nothing here');
    t.equal(body.coverage[3].count, 0, 'a pattern matching nothing counts 0');
});

t.test('a pattern that covers nothing says why', async t => {
    t.plan(7);

    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/me/rules/coverage',
        cookies: { user: owner.id },
        payload: {
            patterns: [
                // covers both notes -- a covering pattern owes no diagnosis
                { kind: 'notes' },
                // names a key none of the fixtures carry, and omits `kind`
                { teacher: 'brown' },
                // names `kind` with the wrong value
                { kind: 'slides' },
            ],
        },
    });

    t.equal(response.statusCode, 200, 'status code');
    const body = response.json();

    t.equal(body.coverage[0].nearest, null, 'a covering pattern has no gap');

    // Every fixture is blocked by the same missing key; the tie breaks on
    // resource id, so the answer is stable across runs.
    t.same(
        body.coverage[1].nearest.missing,
        ['kind'],
        'names the attribute the pattern never mentions',
    );
    t.same(
        body.coverage[1].nearest.conflicting,
        [],
        'nothing conflicts -- the key is simply absent',
    );

    // `kind` IS named, with a value no fixture has. A different mistake, and
    // it reads differently: "you wrote slides, it says notes".
    t.same(
        body.coverage[2].nearest.conflicting,
        ['kind'],
        'names the attribute whose value disagrees',
    );
    t.same(
        body.coverage[2].nearest.missing,
        [],
        'nothing is missing -- the key is present but wrong',
    );
    t.ok(
        typeof body.coverage[2].nearest.name === 'string' &&
            body.coverage[2].nearest.name.length > 0,
        'the gap names a resource the author can recognise',
    );
});
