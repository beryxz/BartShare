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

t.test('get healthz', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/healthz',
    });

    t.equal(response.statusCode, 200, 'status code');
    t.match(response.headers['content-type'], /application\/json/);
    t.same(response.json(), { status: 'UP' }, 'body reports UP');
});

t.test('healthz is absent from the OpenAPI document', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/swagger/raw',
    });

    t.notMatch(response.body, /healthz/, 'no healthz path in the OAS');
});
