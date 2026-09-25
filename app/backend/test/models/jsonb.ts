'use strict';

import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootDb } from '../support/api-harness';
import { Resource, User } from '../../src/models/models';

let dbInstance: Sequelize;
let owner: User;

t.before(async () => {
    dbInstance = await bootDb();
    owner = await User.create({
        attrs: { username: 'jsonb-owner' },
        rules: [],
    });
});
t.after(async () => {
    await dbInstance.close();
});

t.test('attrs and metadata are jsonb columns', async t => {
    t.plan(3);

    // Scoped to current_schema(): information_schema accumulates rows across
    // test runs, so an unscoped query would fail on every run but the first.
    const [rows] = await dbInstance.query(
        `select column_name, data_type from information_schema.columns
         where table_schema = current_schema()
           and table_name = 'Resources' and column_name in ('attrs','metadata')
         order by column_name`,
    );
    const types = (rows as { column_name: string; data_type: string }[]).map(
        r => `${r.column_name}:${r.data_type}`,
    );
    t.same(types, ['attrs:jsonb', 'metadata:jsonb'], 'Resources columns');

    const [userRows] = await dbInstance.query(
        `select data_type from information_schema.columns
         where table_schema = current_schema()
           and table_name = 'Users' and column_name = 'attrs'`,
    );
    t.equal(
        (userRows as { data_type: string }[])[0].data_type,
        'jsonb',
        'Users.attrs',
    );

    // `(k:{"a","b"})` is legal Bart, so an array-valued attribute must
    // survive the round trip for the attr filter to match a member of it.
    const resource = await Resource.create({
        attrs: { topic: ['algebra', 'calculus'], year: 2023 },
        metadata: { name: 'jsonb round trip' },
        UserId: owner.id,
    });
    const reloaded = await Resource.findByPk(resource.id);
    t.same(
        reloaded!.attrs,
        { topic: ['algebra', 'calculus'], year: 2023 },
        'array and number values round-trip',
    );
});
