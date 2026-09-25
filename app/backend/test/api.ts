'use strict';

import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootDb } from './support/api-harness';
import apiSetup from '../src/api';

let dbInstance: Sequelize;

t.before(async () => {
    dbInstance = await bootDb();
});
t.after(async () => {
    await dbInstance.close();
});

t.test('the db instance is decorated on the server', async t => {
    t.plan(1);

    const apiServer = apiSetup(dbInstance);
    t.teardown(() => apiServer.close());
    await apiServer.ready();

    t.equal(apiServer.db, dbInstance);
});

t.test('CORS reflects the request origin', async t => {
    t.plan(3);

    const apiServer = apiSetup(dbInstance);
    t.teardown(() => apiServer.close());
    await apiServer.ready();

    const response = await apiServer.inject({
        method: 'OPTIONS',
        url: '/api/v1/me',
        headers: {
            origin: 'http://localhost:3000',
            'access-control-request-method': 'GET',
        },
    });

    t.equal(
        response.headers['access-control-allow-origin'],
        'http://localhost:3000',
        'the request origin is reflected back',
    );
    t.equal(
        response.headers['access-control-allow-credentials'],
        'true',
        'credentials are allowed',
    );
    t.equal(
        response.headers['access-control-expose-headers'],
        'Content-Disposition',
        'Content-Disposition is exposed to cross-origin clients',
    );
});

/**
 * The content types a form can send cross-origin without a preflight, spelled
 * the ways that reach different branches of Fastify's media-type parser.
 */
const CSRF_SIMPLE_CONTENT_TYPES = [
    'text/plain',
    'text/plain;charset=UTF-8',
    'text/plain; charset="utf-8"',
    'TEXT/PLAIN',
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=x',
];

t.test('CSRF-capable content types are refused', async t => {
    t.plan(CSRF_SIMPLE_CONTENT_TYPES.length + 1);

    const apiServer = apiSetup(dbInstance);
    t.teardown(() => apiServer.close());
    await apiServer.ready();

    // POST /users is public, so the reply is the media-type decision and not a
    // 401 from an auth hook, which runs before the body is parsed.
    for (const contentType of CSRF_SIMPLE_CONTENT_TYPES) {
        const response = await apiServer.inject({
            method: 'POST',
            url: '/api/v1/users',
            headers: { 'content-type': contentType },
            payload: '{"username":"csrf"}',
        });

        t.equal(response.statusCode, 415, `${contentType} is refused`);
    }

    const json = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { 'content-type': 'application/json; charset="utf-8"' },
        payload: '{}',
    });

    // 400 from schema validation rather than 415: the body was parsed.
    t.equal(json.statusCode, 400, 'application/json is still parsed');
});
