'use strict';

import { FastifyInstance, LightMyRequestResponse } from 'fastify';
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

t.test('get swagger', async t => {
    t.plan(10);

    let response: LightMyRequestResponse;

    response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/swagger/ui`,
    });
    t.equal(response.statusCode, 200, '/ui status code');
    t.equal(response.headers['content-type'], 'text/html');
    t.type(response.headers['content-security-policy'], 'string');
    t.notSame(response.headers['content-security-policy'], '');
    t.match(
        response.headers['content-security-policy'],
        /frame-ancestors \*;/,
        'the page is framable from any origin',
    );
    t.notSame(response.body, '');

    response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/swagger/raw`,
    });
    t.equal(response.statusCode, 200, '/raw status code');
    t.equal(response.headers['content-type'], 'application/yaml');
    t.equal(
        response.headers['content-disposition'],
        'attachment; filename=BartShare-openapi.yaml',
    );
    t.notSame(response.body, '');
});
