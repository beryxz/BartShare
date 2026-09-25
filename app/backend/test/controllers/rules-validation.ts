'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import config from '../../src/config';
import { User } from '../../src/models/models';
import { withFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let user: User;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());
    user = await User.create({ attrs: { username: 'rv-base' }, rules: [] });
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

function fakeValidate(lastValidated: { value: string | null }) {
    return (body: string) => {
        lastValidated.value = body;
        return body.includes('BAD')
            ? { valid: false, error: { line: 1, column: 7, message: 'boom' } }
            : { valid: true };
    };
}

t.test('empty rules are validated too', async t => {
    t.plan(3);
    const lastValidated = { value: null as string | null };

    // A party's attributes are half its policy: `(party:(...), rules:())`
    // can still fail to parse, so an empty rule list must not skip validation.
    await withFakeEvaluator(fakeValidate(lastValidated), async () => {
        const response = await apiServer.inject({
            method: 'POST',
            url: '/api/v1/users',
            payload: { attrs: { username: 'rv-empty', a: 'x' }, rules: [] },
        });
        t.equal(response.statusCode, 201, 'status code');
        t.match(
            lastValidated.value ?? '',
            /rules:\(\)/,
            'the rule-less policy still reached the evaluator',
        );
        t.match(
            lastValidated.value ?? '',
            /a:"x"/,
            'carrying the attributes that are the half of it worth validating',
        );
    });
});

t.test('valid rules are stored', async t => {
    t.plan(2);
    const lastValidated = { value: null as string | null };

    await withFakeEvaluator(fakeValidate(lastValidated), async () => {
        const response = await apiServer.inject({
            method: 'POST',
            url: '/api/v1/users',
            payload: {
                attrs: { username: 'rv-valid' },
                rules: ['(resource:(type:"notes"))'],
            },
        });
        t.equal(response.statusCode, 201, 'status code');
        t.same(
            response.json().rules,
            ['(resource:(type:"notes"))'],
            'stored verbatim',
        );
    });
});

t.test('invalid rules are rejected with the position', async t => {
    t.plan(2);
    const lastValidated = { value: null as string | null };

    await withFakeEvaluator(fakeValidate(lastValidated), async () => {
        const response = await apiServer.inject({
            method: 'POST',
            url: '/api/v1/users',
            payload: { attrs: {}, rules: ['(resource:(type:"BAD"))'] },
        });
        t.equal(response.statusCode, 400, 'status code');
        t.match(
            response.json().errors[0],
            /line 1:7/,
            'carries line and column',
        );
    });
});

t.test(
    'what is validated is the assembled policy, not the bare rule',
    async t => {
        t.plan(1);
        const lastValidated = { value: null as string | null };

        await withFakeEvaluator(fakeValidate(lastValidated), async () => {
            await apiServer.inject({
                method: 'POST',
                url: '/api/v1/users',
                payload: {
                    attrs: { username: 'zoe' },
                    rules: ['(resource:(type:"notes"))'],
                },
            });
            t.match(
                lastValidated.value ?? '',
                /^\(party:\(userId:"/,
                'a whole policy was sent',
            );
        });
    },
);

t.test('PATCH /me validates rules too', async t => {
    t.plan(1);
    const lastValidated = { value: null as string | null };

    await withFakeEvaluator(fakeValidate(lastValidated), async () => {
        const response = await apiServer.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            cookies: { user: user.id },
            payload: { rules: ['(resource:(type:"BAD"))'] },
        });
        t.equal(response.statusCode, 400, 'status code');
    });
});

t.test('PATCH /me validates new rules against the new attrs', async t => {
    t.plan(1);
    const lastValidated = { value: null as string | null };

    await withFakeEvaluator(fakeValidate(lastValidated), async () => {
        await apiServer.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            cookies: { user: user.id },
            payload: {
                attrs: { university: 'unifi' },
                rules: ['(resource:(type:"notes"))'],
            },
        });
        t.match(
            lastValidated.value ?? '',
            /university:"unifi"/,
            'the incoming attrs were used',
        );
    });
});

t.test('PATCH /me: valid non-empty rules are persisted', async t => {
    t.plan(3);
    const lastValidated = { value: null as string | null };

    await withFakeEvaluator(fakeValidate(lastValidated), async () => {
        const response = await apiServer.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            cookies: { user: user.id },
            payload: { rules: ['(resource:(type:"notes"))'] },
        });
        t.equal(response.statusCode, 200, 'status code');
        t.same(
            response.json().rules,
            ['(resource:(type:"notes"))'],
            'returned verbatim',
        );

        const stored = await User.findByPk(user.id);
        t.same(
            stored?.rules,
            ['(resource:(type:"notes"))'],
            'actually persisted, not just echoed',
        );
    });

    // Restores the fixture; `rules: []` is validated too, so the fake must
    // stay up or this restore itself answers 503.
    await withFakeEvaluator(fakeValidate(lastValidated), () =>
        apiServer.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            cookies: { user: user.id },
            payload: { rules: [] },
        }),
    );
});

t.test('PATCH /me: an attrs-only patch validates the stored rules', async t => {
    t.plan(3);
    const lastValidated = { value: null as string | null };

    // A body with no `rules` must fall back to these stored ones: sending
    // `[]` instead still answers 200, so only the content differs.
    await user.update({ rules: ['(resource:(type:"stored-note"))'] });

    const response = await withFakeEvaluator(fakeValidate(lastValidated), () =>
        apiServer.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            cookies: { user: user.id },
            payload: { attrs: { username: 'rv-base', mood: 'calm' } },
        }),
    );

    t.equal(response.statusCode, 200, 'status code');
    t.match(
        lastValidated.value ?? '',
        /\(resource:\(type:"stored-note"\)\)/,
        'the stored rules were validated, not an empty rule list',
    );
    t.match(
        lastValidated.value ?? '',
        /mood:"calm"/,
        'and against the incoming attrs',
    );

    await user.update({ rules: [] });
});

// Genuinely unreachable (nothing listens on port 1), unlike the other tests
// here which point at a running fake; the URL must not leak into the body.
t.test(
    'POST /users: an unreachable evaluator is 503, not 400, and does not leak its URL',
    async t => {
        t.plan(3);
        const previousUrl = config.EVALUATOR_URL;
        config.EVALUATOR_URL = 'http://127.0.0.1:1';

        const response = await apiServer.inject({
            method: 'POST',
            url: '/api/v1/users',
            payload: { attrs: {}, rules: ['(resource:(type:"notes"))'] },
        });

        t.equal(response.statusCode, 503, 'status code, not 400');
        t.notMatch(
            JSON.stringify(response.json()),
            /127\.0\.0\.1:1\b/,
            'the evaluator URL is not in the body',
        );
        t.same(
            response.json().errors,
            ['Evaluator service unavailable'],
            'generic message',
        );

        config.EVALUATOR_URL = previousUrl;
    },
);

t.test(
    'PATCH /me: an unreachable evaluator is 503, not 400, and does not leak its URL',
    async t => {
        t.plan(3);
        const previousUrl = config.EVALUATOR_URL;
        config.EVALUATOR_URL = 'http://127.0.0.1:1';

        const response = await apiServer.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            cookies: { user: user.id },
            payload: { rules: ['(resource:(type:"notes"))'] },
        });

        t.equal(response.statusCode, 503, 'status code, not 400');
        t.notMatch(
            JSON.stringify(response.json()),
            /127\.0\.0\.1:1\b/,
            'the evaluator URL is not in the body',
        );
        t.same(
            response.json().errors,
            ['Evaluator service unavailable'],
            'generic message',
        );

        config.EVALUATOR_URL = previousUrl;
    },
);
