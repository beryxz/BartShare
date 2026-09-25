'use strict';

import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootDb } from '../support/api-harness';
import { User } from '../../src/models/models';
import { isUsernameTaken } from '../../src/utils/users.utils';

let dbInstance: Sequelize;

t.before(async () => {
    dbInstance = await bootDb();
});
t.after(async () => {
    await dbInstance.close();
});

t.test('a username is required', async t => {
    t.plan(3);
    await t.rejects(
        User.create({ attrs: {}, rules: [] }),
        { name: 'SequelizeValidationError' },
        'missing rejected',
    );
    await t.rejects(
        User.create({ attrs: { username: '  ' }, rules: [] }),
        { name: 'SequelizeValidationError' },
        'blank rejected',
    );
    await t.rejects(
        User.create({ attrs: { username: 7 }, rules: [] }),
        { name: 'SequelizeValidationError' },
        'non-string rejected',
    );
});

t.test('an over-long username is rejected', async t => {
    t.plan(1);
    await t.rejects(
        User.create({ attrs: { username: 'x'.repeat(129) }, rules: [] }),
        { name: 'SequelizeValidationError' },
        'rejected',
    );
});

t.test('a too-short username is rejected', async t => {
    t.plan(3);
    await t.rejects(
        User.create({ attrs: { username: 'x' }, rules: [] }),
        { name: 'SequelizeValidationError' },
        'one character rejected',
    );
    // Trimmed first, like the blank and 128 checks either side of it.
    await t.rejects(
        User.create({ attrs: { username: ' x ' }, rules: [] }),
        { name: 'SequelizeValidationError' },
        'padded single character rejected',
    );
    await t.resolves(
        User.create({ attrs: { username: 'xy' }, rules: [] }),
        'two characters accepted',
    );
});

t.test('isUsernameTaken finds an existing username', async t => {
    t.plan(3);
    const user = await User.create({
        attrs: { username: 'taken-user' },
        rules: [],
    });

    t.equal(await isUsernameTaken('taken-user'), true, 'found');
    t.equal(await isUsernameTaken('free-user'), false, 'not found');
    t.equal(
        await isUsernameTaken('taken-user', user.id),
        false,
        'the holder does not collide with itself',
    );

    await user.destroy({ force: true });
});
