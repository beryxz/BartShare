'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import config from '../../src/config';
import { Resource, User } from '../../src/models/models';
import { FakeRejection, startFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let caller: User;
let owner: User;
let mine: Resource;
let theirs: Resource;
let previousUrl: string;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    caller = await User.create({ attrs: { username: 's-caller' }, rules: [] });
    owner = await User.create({ attrs: { username: 's-owner' }, rules: [] });
    mine = await Resource.create({
        attrs: { type: 'mine' },
        metadata: { name: 'Mine' },
        UserId: caller.id,
    });
    theirs = await Resource.create({
        attrs: { type: 'theirs' },
        metadata: { name: 'Theirs' },
        UserId: owner.id,
    });
    previousUrl = config.EVALUATOR_URL;
});
t.after(async () => {
    config.EVALUATOR_URL = previousUrl;
    await apiServer.close();
    await dbInstance.close();
});

function get() {
    return apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/shared',
        cookies: { user: caller.id },
    });
}

t.test('a permitted resource is listed, and never my own', async t => {
    t.plan(4);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: true,
            requests: [],
            trace: '',
            scenario: '',
        }),
    });
    config.EVALUATOR_URL = fake.url;

    const response = await get();
    const body = response.json();

    t.equal(response.statusCode, 200, 'status code');
    t.equal(body.data.length, 1, 'exactly one: my own is never a candidate');
    t.equal(body.data[0].id, theirs.id, 'the other owner’s resource');
    t.equal(body.scan.truncated, false, 'nothing was dropped');

    await fake.close();
});

t.test('a denied resource is omitted', async t => {
    t.plan(2);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: false,
            requests: [],
            trace: '',
            scenario: '',
        }),
    });
    config.EVALUATOR_URL = fake.url;

    const response = await get();
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().data.length, 0, 'nothing is shared');

    await fake.close();
});

t.test('one rejected policy does not blank the page', async t => {
    t.plan(2);
    const other = await Resource.create({
        attrs: { type: 'second' },
        metadata: { name: 'Second' },
        UserId: owner.id,
    });

    let call = 0;
    const fake = await startFakeEvaluator({
        evaluate: () => {
            call += 1;
            if (call === 1)
                throw new FakeRejection('bart-syntax', 'line 1:0 mismatched');
            return {
                permitted: true,
                requests: [],
                trace: '',
                scenario: '',
            };
        },
    });
    config.EVALUATOR_URL = fake.url;

    const response = await get();
    t.equal(response.statusCode, 200, 'still a 200');
    t.equal(response.json().data.length, 1, 'the healthy one survives');

    await fake.close();
    await other.destroy({ force: true });
});

t.test(
    'a policy rejected during assembly does not blank the page either',
    async t => {
        t.plan(3);
        // Two candidates under the same failing owner: both see the same
        // cached, rejected assembly promise and must resolve to "not shared".
        const second = await Resource.create({
            attrs: { type: 'second' },
            metadata: { name: 'Second' },
            UserId: owner.id,
        });
        const healthyOwner = await User.create({
            attrs: { username: 's-owner2' },
            rules: [],
        });
        const healthyResource = await Resource.create({
            attrs: { type: 'healthy' },
            metadata: { name: 'Healthy' },
            UserId: healthyOwner.id,
        });

        const fake = await startFakeEvaluator({
            // The failure lands during /analyze/policies, not /evaluate;
            // only the failing owner's own party text contains their uuid.
            analyze: body => {
                if (body.policies.some(text => text.includes(owner.id))) {
                    throw new FakeRejection('bart-model', 'already present');
                }
                return {
                    policies: body.policies.map(() => ({
                        quantified: [],
                        conditionParties: [],
                    })),
                };
            },
            evaluate: () => ({
                permitted: true,
                requests: [],
                trace: '',
                scenario: '',
            }),
        });
        config.EVALUATOR_URL = fake.url;

        const response = await get();
        const body = response.json();

        t.equal(response.statusCode, 200, 'still a 200, not a 500');
        t.equal(
            body.data.length,
            1,
            'only the healthy owner’s resource survives',
        );
        t.equal(
            body.data[0].id,
            healthyResource.id,
            'the failing owner’s resources are both dropped, not just one',
        );

        await fake.close();
        await second.destroy({ force: true });
        await healthyResource.destroy({ force: true });
        await healthyOwner.destroy({ force: true });
    },
);

t.test('an unreachable evaluator is a 503', async t => {
    t.plan(1);
    config.EVALUATOR_URL = 'http://127.0.0.1:1';

    const response = await get();
    t.equal(response.statusCode, 503, 'status code');
});

/**
 * The scan skips a *rejected* candidate, so an evaluator bug read as a rejection would drop
 * the row and still answer 200: a short page that looks complete. A 5xx is an outage.
 */
t.test(
    'an evaluator that fails mid-scan is a 503, not a short page',
    async t => {
        t.plan(1);
        const fake = await startFakeEvaluator({
            evaluate: () => {
                throw new Error('boom');
            },
        });
        config.EVALUATOR_URL = fake.url;

        const response = await get();
        t.equal(response.statusCode, 503, 'status code');

        await fake.close();
    },
);

t.test('unauthenticated is a 401', async t => {
    t.plan(1);
    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/shared',
    });
    t.equal(response.statusCode, 401, 'status code');
});

t.test('get shared: name filter narrows the candidate scan', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/me/shared?name=zzzz-no-such-resource',
        cookies: { user: caller.id },
    });

    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().data.length, 0, 'no rows match');
    // The scan counts candidates matching the filter, so matching nothing
    // means nothing was evaluated.
    t.equal(response.json().scan.total, 0, 'scan.total reflects the filter');
});
