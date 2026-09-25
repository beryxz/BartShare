'use strict';

import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import apiSetup from '../../src/api';
import { User } from '../../src/models/models';
import { requireUserCookie } from '../../src/utils/auth.utils';
import { FastifyTypebox } from '../../src/utils/typebox.utils';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let user: User;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    user = await User.create({ attrs: { username: 'auth-user' }, rules: [] });
    await apiServer.close();
});
t.after(async () => {
    await user.destroy();
    await dbInstance.close();
});

t.test('cookie only login', async t => {
    t.plan(7);

    let response: LightMyRequestResponse;

    apiServer = apiSetup(dbInstance);
    // the prefixed scope mirrors how real route groups register: the cookie
    // check applies to the routes registered alongside it, not globally
    await apiServer.register(
        async function (fastify: FastifyTypebox) {
            requireUserCookie(fastify);

            fastify.get('/loginCookie', (req, res) => {
                return res.status(200).send();
            });
        },
        { prefix: '/api/v1/testing' },
    );
    await apiServer.ready();

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/testing/loginCookie',
    });
    t.equal(response.statusCode, 401, 'no auth status code');
    t.matchOnly(
        response.json(),
        { errors: ['Missing authorization cookie'] },
        'no auth body',
    );
    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/testing/loginCookie',
        cookies: { user: '00000000-0000-0000-0000-000000000000' },
    });
    t.equal(response.statusCode, 401, 'unknown user status code');
    t.matchOnly(
        response.json(),
        { errors: ['Invalid User ID in cookie'] },
        'unknown user body',
    );

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/testing/loginCookie',
        cookies: { user: 'not-a-uuid' },
    });
    t.equal(response.statusCode, 401, 'malformed cookie status code');
    t.matchOnly(
        response.json(),
        { errors: ['Invalid User ID in cookie'] },
        'malformed cookie body',
    );

    response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/testing/loginCookie',
        cookies: { user: user.id },
    });
    t.equal(response.statusCode, 200, 'cookie status code');

    await apiServer.close();
});
