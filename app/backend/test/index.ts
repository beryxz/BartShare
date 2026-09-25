'use strict';

import { QueryTypes } from 'sequelize';
import { test } from 'tap';
import { bootDb } from './support/api-harness';
import apiSetup from '../src/api';

test('setup API server with test DB', async t => {
    t.plan(2);

    const dbInstance = await bootDb();
    t.teardown(() => dbInstance.close());
    const results = await dbInstance.query('SELECT 1 as ready', {
        plain: false,
        raw: true,
        type: QueryTypes.SELECT,
    });
    t.matchOnly(results, [{ ready: 1 }]);

    const apiServer = apiSetup(dbInstance);
    t.teardown(() => apiServer.close());
    await apiServer.ready();
    t.pass();
});
