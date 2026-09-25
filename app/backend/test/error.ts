'use strict';

import {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
    LightMyRequestResponse,
} from 'fastify';
import {
    EmptyResultError,
    Sequelize,
    ValidationError,
    ValidationErrorItem,
} from 'sequelize';
import t from 'tap';
import { bootApi } from './support/api-harness';
import config from '../src/config';
import { mainErrorHandler, notFoundErrorHandler } from '../src/error';
import { User } from '../src/models/models';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let userID: string;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    const user = await User.create({
        attrs: { username: 'error-user' },
        rules: [],
    });
    userID = user.id;
});
t.after(async () => {
    await User.destroy({
        where: {
            id: userID,
        },
    });
    await apiServer.close();
    await dbInstance.close();
});

t.test('unknown endpoint', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/not-existing-path`,
    });
    t.equal(response.statusCode, 404, 'status code');
    t.equal(response.body, '', 'body');
});

t.test('unknown endpoint under authed prefix', async t => {
    t.plan(4);

    // authenticated prefixes install no not-found handler of their own, so an
    // unknown path answers a plain 404 whether or not a cookie is presented
    let response: LightMyRequestResponse;

    response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/me/not-existing-path`,
    });
    t.equal(response.statusCode, 404, 'status code without a cookie');
    t.equal(response.body, '', 'body without a cookie');

    response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/me/not-existing-path`,
        cookies: {
            user: userID,
        },
    });
    t.equal(response.statusCode, 404, 'status code with a valid cookie');
    t.equal(response.body, '', 'body with a valid cookie');
});

t.test('unknown endpoint under a mixed public/authed prefix', async t => {
    t.plan(2);

    // /resources and /groups expose public GETs alongside authed writes; an
    // unknown path under them is a 404 too, not a disguised 401
    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/aaa/bbb`,
    });
    t.equal(response.statusCode, 404, 'status code');
    t.equal(response.body, '', 'body');
});

/**
 * Minimal stand-in for a FastifyReply, so that the handlers can be exercised
 * without going through a whole request lifecycle.
 *
 * @param statusCode the status code already set on the reply
 * @param throwOnStatus status code whose assignment fails, to simulate a
 *                      handler that blows up while replying
 */
function stubReply(statusCode = 200, throwOnStatus?: number) {
    return {
        statusCode,
        payload: undefined as unknown,
        status(code: number) {
            if (code === throwOnStatus) throw new Error('cannot reply');
            this.statusCode = code;
            return this;
        },
        send(payload?: unknown) {
            this.payload = payload;
            return this;
        },
    };
}
type StubReply = ReturnType<typeof stubReply>;

function handleError(error: unknown, reply: StubReply) {
    mainErrorHandler(
        error,
        {} as FastifyRequest,
        reply as unknown as FastifyReply,
    );
    return reply;
}

t.test('mainErrorHandler reports sequelize validation errors', async t => {
    t.plan(2);

    const reply = handleError(
        new ValidationError('invalid', [
            // only the message is read back out, so the item is stubbed
            { message: 'attrs must be an object' } as ValidationErrorItem,
        ]),
        stubReply(),
    );

    t.equal(reply.statusCode, 400, 'status code');
    t.same(reply.payload, { errors: ['attrs must be an object'] }, 'body');
});

t.test('mainErrorHandler masks other sequelize errors', async t => {
    t.plan(2);

    // any BaseError that is not a ValidationError; BaseError is abstract
    const reply = handleError(new EmptyResultError('no rows'), stubReply());

    t.equal(reply.statusCode, 400, 'status code');
    t.same(reply.payload, { errors: ['Invalid operation requested'] }, 'body');
});

t.test('mainErrorHandler picks the status code', async t => {
    t.plan(6);

    const withStatus = Object.assign(new Error('conflict'), {
        statusCode: 409,
    });
    let reply = handleError(withStatus, stubReply());
    t.equal(reply.statusCode, 409, 'from the error itself');
    t.same(reply.payload, { errors: ['conflict'] }, 'error message');

    reply = handleError(new Error('unauthenticated'), stubReply(401));
    t.equal(reply.statusCode, 401, 'from the status already set on the reply');
    t.same(reply.payload, { errors: ['unauthenticated'] }, 'error message');

    reply = handleError('a thrown string', stubReply());
    t.equal(reply.statusCode, 400, 'falls back to 400');
    t.same(reply.payload, { errors: ['undefined error'] }, 'unknown error');
});

t.test('mainErrorHandler adds the raw error in DEBUG mode', async t => {
    t.plan(3);

    const previous = config.DEBUG;
    config.DEBUG = true;
    t.teardown(() => {
        config.DEBUG = previous;
    });

    const reply = handleError(new Error('boom'), stubReply());

    t.equal(reply.statusCode, 400, 'status code');
    const body = reply.payload as { errors: string[] };
    t.equal(body.errors[0], 'boom', 'error message');
    t.equal(body.errors.length, 2, 'the serialized error is appended');
});

t.test('mainErrorHandler falls back to 500 when replying fails', async t => {
    t.plan(2);

    const reply = handleError(new Error('boom'), stubReply(200, 400));

    t.equal(reply.statusCode, 500, 'status code');
    t.equal(reply.payload, undefined, 'empty body');
});

t.test('notFoundErrorHandler replies with an empty 404', async t => {
    t.plan(2);

    const reply = stubReply();
    notFoundErrorHandler(
        {} as FastifyRequest,
        reply as unknown as FastifyReply,
    );

    t.equal(reply.statusCode, 404, 'status code');
    t.equal(reply.payload, undefined, 'empty body');
});
