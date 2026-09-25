'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

t.test('nosniff is set on every response', async t => {
    t.plan(3);

    const ok = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/healthz',
    });
    t.equal(ok.headers['x-content-type-options'], 'nosniff', 'on a 200');

    // The hook has to be global, not a route option: an unknown path is served
    // by the application-wide not-found handler.
    const missing = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/nothing-here',
    });
    t.equal(missing.statusCode, 404, 'the probe really is a 404');
    t.equal(missing.headers['x-content-type-options'], 'nosniff', 'on a 404');
});

t.test('the OpenAPI document advertises a relative server', async t => {
    t.plan(1);

    // API_HOST is a bind address (0.0.0.0 under Compose), never a reachable
    // origin, so the document must resolve against whoever served it instead.
    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/swagger/raw',
    });

    t.match(response.body, /servers:\s*\n\s*- url: \/\s*\n/, 'servers is /');
});
