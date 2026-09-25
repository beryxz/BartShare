'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import config from '../../src/config';
import { Resource, User } from '../../src/models/models';
import { startFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let owner: User;
let caller: User;
let resourceA: Resource;
let previousUrl: string;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    owner = await User.create({ attrs: { username: 'owner' }, rules: [] });
    caller = await User.create({ attrs: { username: 'caller' }, rules: [] });
    resourceA = await Resource.create({
        attrs: { type: 'lectureNotes' },
        metadata: { name: 'Lecture Notes' },
        UserId: owner.id,
    });
    previousUrl = config.EVALUATOR_URL;
});
t.after(async () => {
    config.EVALUATOR_URL = previousUrl;
    await apiServer.close();
    await dbInstance.close();
});

t.test('the owner is permitted without calling the evaluator', async t => {
    t.plan(3);
    config.EVALUATOR_URL = 'http://127.0.0.1:1'; // would fail if called

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/access`,
        cookies: { user: owner.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().permitted, true, 'permitted');
    t.equal(response.json().evaluation, null, 'no evaluation was run');
});

t.test('a permit comes back with the mapped exchange chain', async t => {
    t.plan(4);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: true,
            requests: [
                { requester: 1, from: 2, resource: { type: 'lectureNotes' } },
            ],
            trace: 'evaluating ...',
            scenario: 'scenario text',
        }),
    });
    config.EVALUATOR_URL = fake.url;

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/access`,
        cookies: { user: caller.id },
    });
    const body = response.json();

    t.equal(response.statusCode, 200, 'status code');
    t.equal(body.permitted, true, 'permitted');
    t.same(body.evaluation.parties, [caller.id, owner.id], 'caller is party 1');
    t.same(
        body.evaluation.requests[0],
        {
            requester: caller.id,
            from: owner.id,
            resource: { type: 'lectureNotes' },
        },
        'indexes mapped back to uuids',
    );

    await fake.close();
});

t.test('a denial is 200 with permitted false, not 403', async t => {
    t.plan(3);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: false,
            requests: [],
            trace: 'result: false',
            scenario: 's',
        }),
    });
    config.EVALUATOR_URL = fake.url;

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/access`,
        cookies: { user: caller.id },
    });

    t.equal(response.statusCode, 200, 'a denial is a successful answer');
    t.equal(response.json().permitted, false, 'permitted');
    t.equal(
        response.json().evaluation.trace,
        'result: false',
        'trace always included',
    );

    await fake.close();
});

t.test('the assembled body carries one context slot per party', async t => {
    t.plan(2);
    let sent: Record<string, unknown> = {};
    const fake = await startFakeEvaluator({
        evaluate: body => {
            sent = body;
            return { permitted: false, requests: [], trace: '', scenario: '' };
        },
    });
    config.EVALUATOR_URL = fake.url;

    await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/access`,
        cookies: { user: caller.id },
    });

    t.equal((sent.policies as string[]).length, 2, 'two policies');
    t.equal(
        (sent.context as string).split('),(').length,
        2,
        'arity matches the policy count',
    );

    await fake.close();
});

t.test(
    'decideAccess wires emitRequest with requester 1, any:userId, and the resource attrs',
    async t => {
        t.plan(1);
        // Asserts the exact `request` line the evaluator receives, so an
        // `'all'` swapped in for `'any'` fails here.
        let sent: Record<string, unknown> = {};
        const fake = await startFakeEvaluator({
            evaluate: body => {
                sent = body;
                return {
                    permitted: false,
                    requests: [],
                    trace: '',
                    scenario: '',
                };
            },
        });
        config.EVALUATOR_URL = fake.url;

        await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${resourceA.id}/access`,
            cookies: { user: caller.id },
        });

        t.equal(
            sent.request,
            `1 : (resource:(type:"lectureNotes"), from:(any:(userId:"${owner.id}")))`,
            'requester index 1, any-quantified userId targeting the owner, resource attrs verbatim',
        );

        await fake.close();
    },
);

t.test(
    'a party that vanishes between discovery and the snapshot read is not silently dropped',
    async t => {
        t.plan(2);
        const phantom = await User.create({
            attrs: { username: 'phantom', tag: 'unique-phantom-tag' },
            rules: [],
        });

        const fake = await startFakeEvaluator({
            analyze: body => {
                const texts = body.policies;
                if (texts.some(text => text.includes(phantom.id))) {
                    // Round 2: the phantom's own (placeholder) text; nothing left to find.
                    return {
                        policies: texts.map(() => ({
                            quantified: [],
                            conditionParties: [],
                        })),
                    };
                }
                // Round 1: report a quantified `from` the phantom matches, then
                // delete it right here, between discovery and the next read.
                return User.destroy({
                    where: { id: phantom.id },
                    force: true,
                }).then(() => ({
                    policies: texts.map(() => ({
                        quantified: [
                            {
                                role: 'from',
                                quant: 'any',
                                attrs: { tag: 'unique-phantom-tag' },
                            },
                        ],
                        conditionParties: [],
                    })),
                }));
            },
            evaluate: () => ({
                permitted: false,
                requests: [],
                trace: '',
                scenario: '',
            }),
        });
        config.EVALUATOR_URL = fake.url;

        const response = await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${resourceA.id}/access`,
            cookies: { user: caller.id },
        });

        t.equal(response.statusCode, 200, 'still answers instead of erroring');
        t.equal(
            response.json().evaluation.parties.length,
            3,
            'the vanished party is still counted, not dropped',
        );

        await fake.close();
    },
);

t.test(
    'a `(userId:"…")` pattern pulls that user into the party set',
    async t => {
        t.plan(1);
        // emitPolicy writes party attrs as `{userId: <row PK>, ...attrs}`, so a
        // `userId` pattern must match against that, not the raw row attrs.
        const target = await User.create({
            attrs: { username: 'target-by-userid' },
            rules: [],
        });

        const fake = await startFakeEvaluator({
            analyze: body => {
                const texts = body.policies;
                const alreadyReachedTarget = texts.some(text =>
                    text.includes(target.id),
                );
                return {
                    policies: texts.map(() => ({
                        quantified: alreadyReachedTarget
                            ? []
                            : [
                                  {
                                      role: 'from',
                                      quant: 'any',
                                      attrs: { userId: target.id },
                                  },
                              ],
                        conditionParties: [],
                    })),
                };
            },
            evaluate: () => ({
                permitted: false,
                requests: [],
                trace: '',
                scenario: '',
            }),
        });
        config.EVALUATOR_URL = fake.url;

        const response = await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${resourceA.id}/access`,
            cookies: { user: caller.id },
        });

        t.ok(
            response.json().evaluation.parties.includes(target.id),
            'the userId pattern matched the target, not nobody',
        );

        await fake.close();
        await User.destroy({ where: { id: target.id }, force: true });
    },
);

t.test(
    'a stored row that predates write-time validation is a 500, not a 400',
    async t => {
        t.plan(2);
        // Bypasses the controller to simulate a row validateAttrs would reject
        // today; emitPolicy -> emitAttrs throws while assembling the closure.
        const badOwner = await User.create({
            attrs: { username: 'bad-owner', bad: null } as unknown as Record<
                string,
                unknown
            >,
            rules: [],
        });
        const badResource = await Resource.create({
            attrs: { type: 'lectureNotes' },
            metadata: { name: 'Lecture Notes' },
            UserId: badOwner.id,
        });

        const response = await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${badResource.id}/access`,
            cookies: { user: caller.id },
        });

        t.equal(response.statusCode, 500, 'status code');
        t.notMatch(
            response.json().errors[0],
            /BartEmitError|values must be a string/,
            'the emitter-internal message is not leaked verbatim',
        );

        await badResource.destroy({ force: true });
        await badOwner.destroy({ force: true });
    },
);

t.test('an unknown resource is 404', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/resources/00000000-0000-0000-0000-000000000000/access',
        cookies: { user: caller.id },
    });
    t.equal(response.statusCode, 404, 'status code');
});

t.test('no cookie is 401', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/access`,
    });
    t.equal(response.statusCode, 401, 'status code');
});

t.test('an unreachable evaluator is 503', async t => {
    t.plan(1);
    config.EVALUATOR_URL = 'http://127.0.0.1:1';

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/access`,
        cookies: { user: caller.id },
    });
    t.equal(response.statusCode, 503, 'status code');
});

t.test('a rejected policy is 500 naming the user', async t => {
    t.plan(2);
    const fake = await startFakeEvaluator({
        fail: {
            status: 400,
            body: {
                error: 'bart-syntax',
                detail: 'line 1:5 boom',
                location: 'policy 2',
            },
        },
    });
    config.EVALUATOR_URL = fake.url;

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/access`,
        cookies: { user: caller.id },
    });

    t.equal(response.statusCode, 500, 'status code');
    t.match(
        response.json().errors[0],
        new RegExp(owner.id),
        'policy 2 is the owner',
    );

    await fake.close();
});

t.test(
    'a rejection with an unplaceable location is still a 500, unresolved',
    async t => {
        t.plan(3);
        const fake = await startFakeEvaluator({
            fail: {
                status: 400,
                body: {
                    error: 'bart-syntax',
                    detail: 'raw detail, no location to work with',
                    location: null,
                },
            },
        });
        config.EVALUATOR_URL = fake.url;

        const response = await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${resourceA.id}/access`,
            cookies: { user: caller.id },
        });

        t.equal(response.statusCode, 500, 'status code');
        t.match(
            response.json().errors[0],
            /raw detail, no location to work with/,
            'the original detail is preserved',
        );
        t.notMatch(
            response.json().errors[0],
            /user /,
            'nothing was resolved, so nothing is blamed',
        );

        await fake.close();
    },
);
