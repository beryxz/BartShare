'use strict';

import t from 'tap';
import { isPostgresConnectionString } from '../../src/utils/config.utils';

t.test('isPostgresConnectionString', async t => {
    t.plan(5);

    t.ok(
        isPostgresConnectionString('postgres://user:pass@localhost:5432/db'),
        'full connection string',
    );
    t.ok(
        isPostgresConnectionString('postgres://db-host/db?sslmode=require'),
        'query components are allowed',
    );
    t.notOk(
        isPostgresConnectionString('mysql://user:pass@localhost:3306/db'),
        'other dialects are rejected',
    );
    t.notOk(
        isPostgresConnectionString('localhost:5432/db'),
        'the protocol is required',
    );
    t.notOk(isPostgresConnectionString(''), 'empty string');
});
