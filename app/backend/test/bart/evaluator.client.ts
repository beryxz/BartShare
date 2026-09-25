'use strict';

import http from 'node:http';
import t from 'tap';
import {
    analyzePolicies,
    EvaluatorRejectedError,
    EvaluatorUnavailableError,
    evaluate,
    mapEvaluatorError,
    validatePolicy,
} from '../../src/bart/evaluator.client';
import { startFakeEvaluator } from '../support/fake-evaluator';

// The client reads config.EVALUATOR_URL at call time, so a test may repoint it.
import config from '../../src/config';

t.test('analyzePolicies unwraps the positional response', async t => {
    t.plan(3);
    const fake = await startFakeEvaluator({
        analyze: () => ({
            policies: [
                { quantified: [], conditionParties: [] },
                {
                    quantified: [
                        { role: 'from', quant: 'any', attrs: { a: 'b' } },
                    ],
                    conditionParties: [{ attrs: { role: 'auditor' } }],
                },
            ],
        }),
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    const result = await analyzePolicies(['p1', 'p2']);

    t.same(result[0], [], 'first policy has none');
    t.same(
        result[1],
        [{ attrs: { a: 'b' } }, { attrs: { role: 'auditor' } }],
        'exchange and condition patterns are concatenated, attrs only',
    );
    t.equal(result.length, 2, 'one entry per policy');

    config.EVALUATOR_URL = previous;
    await fake.close();
});

t.test('validatePolicy passes the finding through', async t => {
    t.plan(2);
    const fake = await startFakeEvaluator({
        validate: () => ({
            valid: false,
            error: { line: 1, column: 5, message: 'boom' },
        }),
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    const result = await validatePolicy('nonsense');

    t.notOk(result.valid, 'invalid');
    t.equal(result.error?.message, 'boom', 'message');

    config.EVALUATOR_URL = previous;
    await fake.close();
});

t.test('evaluate returns the whole result', async t => {
    t.plan(2);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: true,
            requests: [{ requester: 1, from: 2, resource: { type: 'notes' } }],
            trace: 'evaluating',
            scenario: 'scenario',
        }),
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    const result = await evaluate({
        policies: ['p'],
        context: '()',
        request: '1 : (r)',
    });

    t.ok(result.permitted, 'permitted');
    t.equal(result.trace, 'evaluating', 'trace passed through');

    config.EVALUATOR_URL = previous;
    await fake.close();
});

t.test('an ApiError becomes EvaluatorRejectedError with its slug', async t => {
    t.plan(3);
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
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    await t.rejects(
        evaluate({ policies: ['p'], context: '()', request: 'r' }),
        EvaluatorRejectedError,
        'rejected',
    );
    try {
        await evaluate({ policies: ['p'], context: '()', request: 'r' });
    } catch (error) {
        t.equal((error as EvaluatorRejectedError).slug, 'bart-syntax', 'slug');
        t.equal(
            (error as EvaluatorRejectedError).location,
            'policy 2',
            'location',
        );
    }

    config.EVALUATOR_URL = previous;
    await fake.close();
});

/**
 * Spring's default error body also has an `error` field, but it holds a human
 * phrase, not a slug, e.g. "Unsupported Media Type".
 */
t.test('a Spring default error body is not mistaken for a slug', async t => {
    t.plan(1);
    const fake = await startFakeEvaluator({
        fail: {
            status: 415,
            body: {
                timestamp: '2026-07-28T00:00:00Z',
                status: 415,
                error: 'Unsupported Media Type',
                path: '/evaluate',
            },
        },
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    try {
        await evaluate({ policies: ['p'], context: '()', request: 'r' });
        t.fail('should have thrown');
    } catch (error) {
        t.equal(
            (error as EvaluatorRejectedError).slug,
            'unknown',
            'no detail field means no slug',
        );
    }

    config.EVALUATOR_URL = previous;
    await fake.close();
});

/**
 * The `detail` probe only proves the body isn't Spring's default shape, not
 * that it's a well-formed ApiError: a body with `detail` but no `error` must
 * still yield a usable slug, not `undefined`.
 */
t.test(
    'a body with detail but no error still yields a usable slug',
    async t => {
        t.plan(2);
        const fake = await startFakeEvaluator({
            fail: { status: 400, body: { detail: 'something failed' } },
        });
        const previous = config.EVALUATOR_URL;
        config.EVALUATOR_URL = fake.url;

        try {
            await evaluate({ policies: ['p'], context: '()', request: 'r' });
            t.fail('should have thrown');
        } catch (error) {
            t.equal(
                (error as EvaluatorRejectedError).slug,
                'unknown',
                'slug never undefined',
            );
            t.equal(
                (error as EvaluatorRejectedError).detail,
                'something failed',
                'the detail we did get is preserved',
            );
        }

        config.EVALUATOR_URL = previous;
        await fake.close();
    },
);

/**
 * The `'detail' in body` probe only proves the key exists, not that its value
 * is a string: `detail: null` must come out as an empty string, not `null`
 * leaking into a field typed `string`.
 */
t.test(
    'a body with a null detail becomes an empty string, not null',
    async t => {
        t.plan(1);
        const fake = await startFakeEvaluator({
            fail: { status: 400, body: { error: 'bart-syntax', detail: null } },
        });
        const previous = config.EVALUATOR_URL;
        config.EVALUATOR_URL = fake.url;

        try {
            await evaluate({ policies: ['p'], context: '()', request: 'r' });
            t.fail('should have thrown');
        } catch (error) {
            t.equal(
                (error as EvaluatorRejectedError).detail,
                '',
                'a null detail is not passed through as-is',
            );
        }

        config.EVALUATOR_URL = previous;
        await fake.close();
    },
);

/**
 * `location` is optional on `ApiError` (`empty-policies` has none); this covers
 * the fallback's normal path, as opposed to the malformed-body case below.
 */
t.test('an ApiError without a location falls back to null', async t => {
    t.plan(1);
    const fake = await startFakeEvaluator({
        fail: {
            status: 400,
            body: {
                error: 'empty-policies',
                detail: 'policies must not be empty',
            },
        },
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    try {
        await evaluate({ policies: [], context: '()', request: 'r' });
        t.fail('should have thrown');
    } catch (error) {
        t.equal(
            (error as EvaluatorRejectedError).location,
            null,
            'no location field means no location',
        );
    }

    config.EVALUATOR_URL = previous;
    await fake.close();
});

/** E.g. a proxy's HTML page: not valid JSON, but must not crash the client. */
t.test('a non-JSON error body still becomes an unknown rejection', async t => {
    t.plan(1);
    const fake = await startFakeEvaluator({
        fail: { status: 400, body: 'upstream rewrote the body' },
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    try {
        await evaluate({ policies: ['p'], context: '()', request: 'r' });
        t.fail('should have thrown');
    } catch (error) {
        t.equal(
            (error as EvaluatorRejectedError).slug,
            'unknown',
            'no JSON body means no slug',
        );
    }

    config.EVALUATOR_URL = previous;
    await fake.close();
});

/**
 * The body is ApiError-shaped on purpose: status decides, not shape. A 5xx read as a
 * rejection would let the shared-with-me scan skip the row and still answer 200.
 */
t.test('a 5xx is unavailability whatever the body looks like', async t => {
    t.plan(1);
    const fake = await startFakeEvaluator({
        fail: {
            status: 500,
            body: { error: 'bart-syntax', detail: 'looks like your fault' },
        },
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    await t.rejects(
        evaluate({ policies: ['p'], context: '()', request: 'r' }),
        EvaluatorUnavailableError,
        'the service failed, so the input is not what was wrong',
    );

    config.EVALUATOR_URL = previous;
    await fake.close();
});

t.test('an unreachable evaluator is EvaluatorUnavailableError', async t => {
    t.plan(1);
    const previous = config.EVALUATOR_URL;
    // Port 1 is reserved and nothing listens on it.
    config.EVALUATOR_URL = 'http://127.0.0.1:1';

    await t.rejects(
        analyzePolicies(['p']),
        EvaluatorUnavailableError,
        'connection refused is unavailability, not rejection',
    );

    config.EVALUATOR_URL = previous;
});

t.test('mapEvaluatorError: unavailable maps to 503', async t => {
    t.plan(2);
    const mapped = mapEvaluatorError(
        new EvaluatorUnavailableError(
            'could not reach the evaluator at http://internal-host:8080/evaluate: boom',
        ),
    );
    t.equal(mapped?.status, 503, 'status');
    t.notMatch(
        mapped?.errors[0] ?? '',
        /internal-host/,
        'the internal URL never reaches the response',
    );
});

t.test('mapEvaluatorError: rejected maps to 500 with the detail', async t => {
    t.plan(2);
    const mapped = mapEvaluatorError(
        new EvaluatorRejectedError('bart-syntax', 'line 1:5 boom', null),
    );
    t.equal(mapped?.status, 500, 'status');
    t.match(mapped?.errors[0] ?? '', /line 1:5 boom/, 'detail preserved');
});

t.test('mapEvaluatorError: any other error is not its concern', async t => {
    t.plan(1);
    t.equal(
        mapEvaluatorError(new Error('unrelated')),
        null,
        'callers fall through to rethrow',
    );
});

/** A server that answers 200 with whatever raw bytes the test wants. */
async function startRawServer(
    handler: (res: http.ServerResponse) => void,
): Promise<{ url: string; close(): Promise<void> }> {
    const server = http.createServer((_req, res) => handler(res));
    await new Promise<void>(resolve =>
        server.listen(0, '127.0.0.1', () => resolve()),
    );
    const address = server.address() as { port: number };
    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
            new Promise<void>(resolve => server.close(() => resolve())),
    };
}

t.test('a non-JSON 200 body is an unavailable evaluator', async t => {
    t.plan(1);
    // fetch() resolves on headers; the body read that follows must still land
    // in one of the two error classes rather than an unmapped 400.
    const fake = await startRawServer(res => {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html>502 Bad Gateway</html>');
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    await t.rejects(
        analyzePolicies(['p1']),
        EvaluatorUnavailableError,
        'surfaces as unavailable, not as an unmapped error',
    );

    config.EVALUATOR_URL = previous;
    await fake.close();
});

t.test('a body truncated mid-stream is an unavailable evaluator', async t => {
    t.plan(1);
    const fake = await startRawServer(res => {
        // flushHeaders() decouples the headers so fetch() resolves before the
        // connection dies; setTimeout defers write+destroy past that window.
        res.writeHead(200, { 'content-type': 'application/json' });
        res.flushHeaders();
        setTimeout(() => {
            res.write('{"policies":[');
            res.destroy();
        }, 50);
    });
    const previous = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    await t.rejects(
        analyzePolicies(['p1']),
        EvaluatorUnavailableError,
        'a dropped connection mid-body is unavailability',
    );

    config.EVALUATOR_URL = previous;
    await fake.close();
});
