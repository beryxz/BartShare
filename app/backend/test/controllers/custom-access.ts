'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import config from '../../src/config';
import { User } from '../../src/models/models';
import { startFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let caller: User;
let target: User;
let previousUrl: string;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    caller = await User.create({
        attrs: { username: 'x-caller', degreeProgram: 'cs' },
        rules: [],
    });
    target = await User.create({
        attrs: { username: 'x-target', degreeProgram: 'cs' },
        rules: [],
    });
    previousUrl = config.EVALUATOR_URL;
});
t.after(async () => {
    config.EVALUATOR_URL = previousUrl;
    await apiServer.close();
    await dbInstance.close();
});

function post(payload: unknown, userId: string = caller.id) {
    return apiServer.inject({
        method: 'POST',
        url: '/api/v1/resources/access',
        cookies: { user: userId },
        payload: payload as Record<string, unknown>,
    });
}

t.test('a quantified from pattern seeds the closure', async t => {
    t.plan(4);
    let seenRequest = '';
    const fake = await startFakeEvaluator({
        evaluate: body => {
            seenRequest = String(body.request);
            return {
                permitted: true,
                requests: [],
                trace: 't',
                scenario: 's',
            };
        },
    });
    config.EVALUATOR_URL = fake.url;

    const response = await post({
        resource: { type: 'lectureNotes' },
        from: { quantifier: 'any', attrs: { degreeProgram: 'cs' } },
    });
    const body = response.json();

    t.equal(response.statusCode, 200, 'status code');
    t.equal(body.permitted, true, 'permitted');
    t.same(
        body.evaluation.parties,
        [caller.id, target.id],
        'the caller is party 1 and is not duplicated by the pattern',
    );
    t.equal(
        seenRequest,
        '1 : (resource:(type:"lectureNotes"), from:(any:(degreeProgram:"cs")))',
        'the request line the caller composed',
    );

    await fake.close();
});

t.test('a from pattern matching nobody denies', async t => {
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

    const response = await post({
        resource: { type: 'lectureNotes' },
        from: {
            quantifier: 'all',
            attrs: { degreeProgram: 'nobody-has-this' },
        },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().permitted, false, 'denied, not vacuously true');

    await fake.close();
});

t.test('an empty resource pattern is a 400, not a wildcard permit', async t => {
    t.plan(1);
    const response = await post({
        resource: {},
        from: { quantifier: 'any', attrs: {} },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('a reserved key in resource is rejected', async t => {
    t.plan(1);
    const response = await post({
        resource: { userId: 'x' },
        from: { quantifier: 'any', attrs: {} },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('userId is allowed in the from pattern', async t => {
    t.plan(1);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: true,
            requests: [],
            trace: '',
            scenario: '',
        }),
    });
    config.EVALUATOR_URL = fake.url;

    const response = await post({
        resource: { type: 'lectureNotes' },
        from: { quantifier: 'any', attrs: { userId: target.id } },
    });
    t.equal(response.statusCode, 200, 'status code');

    await fake.close();
});

t.test('an unknown quantifier is rejected by the schema', async t => {
    t.plan(1);
    const response = await post({
        resource: { type: 'lectureNotes' },
        from: { quantifier: 'some', attrs: {} },
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('unauthenticated is a 401', async t => {
    t.plan(1);
    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/resources/access',
        payload: {
            resource: { type: 'lectureNotes' },
            from: { quantifier: 'any', attrs: {} },
        },
    });
    t.equal(response.statusCode, 401, 'status code');
});

// These endpoints reach the same evaluateAssembled, so the same
// EvaluatorUnavailableError / EvaluatorRejectedError surface from either.
t.test('an unreachable evaluator is 503', async t => {
    t.plan(1);
    config.EVALUATOR_URL = 'http://127.0.0.1:1';

    const response = await post({
        resource: { type: 'lectureNotes' },
        from: { quantifier: 'any', attrs: {} },
    });
    t.equal(response.statusCode, 503, 'status code');
});

t.test('a rejected policy is a 500', async t => {
    t.plan(2);
    const fake = await startFakeEvaluator({
        fail: {
            status: 400,
            body: {
                error: 'bart-syntax',
                detail: 'line 1:5 boom',
                location: 'policy 1',
            },
        },
    });
    config.EVALUATOR_URL = fake.url;

    const response = await post({
        resource: { type: 'lectureNotes' },
        from: { quantifier: 'any', attrs: {} },
    });

    t.equal(response.statusCode, 500, 'status code');
    t.notMatch(
        response.json().errors[0],
        new RegExp(config.EVALUATOR_URL),
        'the evaluator URL is never forwarded to the caller',
    );

    await fake.close();
});

t.test(
    "a third party's stored row that predates write-time validation is a 500, not a 400",
    async t => {
        t.plan(2);
        // The caller's own resource/from are validated up front, so the only
        // BartEmitError reaching the catch comes from a stored row belonging
        // to somebody else; blaming the caller with a 400 would be wrong.
        const badTarget = await User.create({
            attrs: {
                username: 'x-bad-target',
                degreeProgram: 'cs',
                bad: null,
            } as unknown as Record<string, unknown>,
            rules: [],
        });

        const fake = await startFakeEvaluator({
            evaluate: () => ({
                permitted: true,
                requests: [],
                trace: 't',
                scenario: 's',
            }),
        });
        config.EVALUATOR_URL = fake.url;

        const response = await post({
            resource: { type: 'lectureNotes' },
            from: { quantifier: 'any', attrs: { degreeProgram: 'cs' } },
        });

        t.equal(response.statusCode, 500, 'status code');
        t.notMatch(
            response.json().errors[0],
            /BartEmitError|values must be a string/,
            'the emitter-internal message is not leaked verbatim',
        );

        await fake.close();
        await badTarget.destroy({ force: true });
    },
);
