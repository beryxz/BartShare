'use strict';

import t from 'tap';
import { db } from '../src/db';

t.test('rejects unsupported dialects', async t => {
    t.plan(1);

    await t.rejects(
        db('mysql://user:pass@localhost:3306/db'),
        /Database dialect not currently supported/,
        'only postgres is supported',
    );
});

t.test('resolves even when the database is unreachable', async t => {
    t.plan(1);

    // the connection error is logged, not thrown: the caller gets an instance
    // it can retry with
    const instance = await db('postgres://postgres:postgres@127.0.0.1:1/none');
    t.teardown(() => instance.close());

    t.equal(instance.getDialect(), 'postgres', 'an instance is returned');
});
