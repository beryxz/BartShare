import Fastify, { FastifyInstance, FastifyReply } from 'fastify';
import config from '../../src/config';

export type FakeHandlers = {
    analyze?: (body: { policies: string[] }) => unknown;
    validate?: (body: string) => unknown;
    evaluate?: (body: Record<string, unknown>) => unknown;
    /** Set to reply with this status and an ApiError-shaped body instead. */
    fail?: { status: number; body: unknown };
};

/**
 * Throw from a handler to answer as bart-wrapper's `ApiError` does. A bare `throw` is a 500,
 * which the client reads as an outage, so a test about bad *input* has to say so with a status.
 */
export class FakeRejection extends Error {
    readonly status: number;
    readonly slug: string;
    readonly detail: string;

    constructor(slug: string, detail: string, status: number = 400) {
        super(`${slug}: ${detail}`);
        this.name = 'FakeRejection';
        this.status = status;
        this.slug = slug;
        this.detail = detail;
    }
}

async function answering(
    reply: FastifyReply,
    produce: () => unknown,
): Promise<unknown> {
    try {
        return await produce();
    } catch (error) {
        if (error instanceof FakeRejection) {
            return reply
                .status(error.status)
                .send({ error: error.slug, detail: error.detail });
        }
        throw error;
    }
}

/**
 * A stand-in for bart-wrapper on an ephemeral port, so controller tests need no JVM.
 * It is deliberately dumb: it echoes whatever the handler returns and does not parse `.bart`.
 */
export async function startFakeEvaluator(
    handlers: FakeHandlers = {},
): Promise<{ url: string; close(): Promise<void>; server: FastifyInstance }> {
    const server = Fastify();

    server.addContentTypeParser(
        'text/plain',
        { parseAs: 'string' },
        (_req, body, done) => done(null, body),
    );

    // The real bart-wrapper's liveness probe, which `health()` in
    // evaluator.client.ts calls. Not driven by a handler: there is nothing to
    // vary, and `handlers.fail` already covers "answers, but badly".
    server.get('/health', async (_request, reply) => {
        if (handlers.fail)
            return reply.status(handlers.fail.status).send(handlers.fail.body);
        return { status: 'UP' };
    });

    server.post('/analyze/policies', async (request, reply) => {
        if (handlers.fail)
            return reply.status(handlers.fail.status).send(handlers.fail.body);
        const body = request.body as { policies: string[] };
        return answering(reply, () =>
            handlers.analyze
                ? handlers.analyze(body)
                : {
                      policies: body.policies.map(() => ({
                          quantified: [],
                          conditionParties: [],
                      })),
                  },
        );
    });

    server.post('/validate/policy', async (request, reply) => {
        if (handlers.fail)
            return reply.status(handlers.fail.status).send(handlers.fail.body);
        return answering(reply, () =>
            handlers.validate
                ? handlers.validate(request.body as string)
                : { valid: true },
        );
    });

    server.post('/evaluate', async (request, reply) => {
        if (handlers.fail)
            return reply.status(handlers.fail.status).send(handlers.fail.body);
        return answering(reply, () =>
            handlers.evaluate
                ? handlers.evaluate(request.body as Record<string, unknown>)
                : { permitted: false, requests: [], trace: '', scenario: '' },
        );
    });

    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.addresses()[0];

    return {
        url: `http://127.0.0.1:${address.port}`,
        server,
        close: () => server.close(),
    };
}

/**
 * The fake evaluator binds a real socket. Sharing one instance across tests
 * via top-level `t.before`/`t.after` hangs the file until tap's own timeout
 * kills it, independent of fetch, the DB, or apiServer. Keeping the
 * lifecycle scoped to one test avoids that, while still saving boilerplate.
 */
export async function withFakeEvaluator<T>(
    validate: (body: string) => unknown,
    fn: () => Promise<T>,
): Promise<T> {
    const fake = await startFakeEvaluator({ validate });
    const previousUrl = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;
    try {
        return await fn();
    } finally {
        config.EVALUATOR_URL = previousUrl;
        await fake.close();
    }
}
