'use strict';

import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootDb } from '../support/api-harness';
import { Resource, User } from '../../src/models/models';

let dbInstance: Sequelize;
let owner: User;

t.before(async () => {
    dbInstance = await bootDb();
    owner = await User.create({ attrs: { username: 'owner' }, rules: [] });
});
t.after(async () => {
    await dbInstance.close();
});

async function creating(metadata: unknown): Promise<Resource> {
    return Resource.create({
        attrs: { kind: 'note' },
        metadata: metadata as Record<string, unknown>,
        UserId: owner.id,
    });
}

t.test('metadata with a name is accepted', async t => {
    t.plan(1);
    const resource = await creating({ name: 'Notes', description: 'x' });
    t.same(resource.metadata, { name: 'Notes', description: 'x' }, 'stored');
    await resource.destroy({ force: true });
});

t.test('metadata is required to carry a name', async t => {
    t.plan(1);
    await t.rejects(
        creating({}),
        { name: 'SequelizeValidationError' },
        'rejected',
    );
});

t.test('an omitted metadata defaults to {} and fails validation', async t => {
    t.plan(1);
    await t.rejects(
        Resource.create({ attrs: { kind: 'note' }, UserId: owner.id }),
        { name: 'SequelizeValidationError' },
        'rejected',
    );
});

t.test('a blank name is rejected', async t => {
    t.plan(1);
    await t.rejects(
        creating({ name: '   ' }),
        { name: 'SequelizeValidationError' },
        'rejected',
    );
});

t.test('an over-long name is rejected', async t => {
    t.plan(1);
    await t.rejects(
        creating({ name: 'x'.repeat(257) }),
        { name: 'SequelizeValidationError' },
        'rejected',
    );
});

t.test('a non-object metadata is rejected', async t => {
    t.plan(2);
    await t.rejects(
        creating(['name']),
        { name: 'SequelizeValidationError' },
        'array rejected',
    );
    await t.rejects(
        creating('name'),
        { name: 'SequelizeValidationError' },
        'string rejected',
    );
});

t.test('a non-string description is rejected', async t => {
    t.plan(2);
    await t.rejects(
        creating({ name: 'Notes', description: 7 }),
        { name: 'SequelizeValidationError' },
        'number rejected',
    );
    await t.rejects(
        creating({ name: 'Notes', description: 'x'.repeat(2049) }),
        { name: 'SequelizeValidationError' },
        'over-long rejected',
    );
});

t.test('metadata over 64KB is rejected', async t => {
    t.plan(1);
    await t.rejects(
        creating({ name: 'Notes', blob: 'x'.repeat(70 * 1024) }),
        { name: 'SequelizeValidationError' },
        'rejected',
    );
});

t.test('free-form keys are allowed', async t => {
    t.plan(1);
    const resource = await creating({ name: 'Notes', tags: ['a'], n: 1 });
    t.same(resource.metadata.tags, ['a'], 'arbitrary keys survive');
    await resource.destroy({ force: true });
});
