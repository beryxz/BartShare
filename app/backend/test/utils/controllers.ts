'use strict';

import { Op } from 'sequelize';
import t from 'tap';
import {
    whereAttrContains,
    whereJsonSubstring,
} from '../../src/utils/controllers.utils';

/**
 * `whereJsonSubstring` only reads `db.getDialect()`, so a two-line stand-in is
 * enough and avoids booting a server for a pure function.
 */
const pg = { db: { getDialect: () => 'postgres' } } as never;

t.test('whereJsonSubstring', async t => {
    t.plan(3);

    t.same(whereJsonSubstring(pg, 'metadata.name', undefined), {}, 'no value');
    t.same(whereJsonSubstring(pg, 'metadata.name', ''), {}, 'empty value');
    t.same(
        whereJsonSubstring(pg, 'metadata.name', 'alg'),
        { 'metadata.name': { [Op.iLike]: '%alg%' } },
        'postgres uses iLike with wildcards',
    );
});

t.test('whereAttrContains', async t => {
    t.plan(5);

    t.same(whereAttrContains('attrs', undefined), {}, 'no filter');

    // A scalar and an array never cross-match under jsonb containment, so both
    // forms must be probed or half the corpus is silently invisible.
    t.same(
        whereAttrContains('attrs', 'type:notes'),
        {
            [Op.or]: [
                { attrs: { [Op.contains]: { type: 'notes' } } },
                { attrs: { [Op.contains]: { type: ['notes'] } } },
            ],
        },
        'string value probes scalar and array',
    );

    // Containment is type-strict and query params are strings, so a numeric
    // attribute is unreachable without the typed probes.
    t.same(
        whereAttrContains('attrs', 'year:2023'),
        {
            [Op.or]: [
                { attrs: { [Op.contains]: { year: '2023' } } },
                { attrs: { [Op.contains]: { year: ['2023'] } } },
                { attrs: { [Op.contains]: { year: 2023 } } },
                { attrs: { [Op.contains]: { year: [2023] } } },
            ],
        },
        'numeric-looking value also probes the number form',
    );

    t.same(
        whereAttrContains('attrs', 'active:true'),
        {
            [Op.or]: [
                { attrs: { [Op.contains]: { active: 'true' } } },
                { attrs: { [Op.contains]: { active: ['true'] } } },
                { attrs: { [Op.contains]: { active: true } } },
                { attrs: { [Op.contains]: { active: [true] } } },
            ],
        },
        'boolean-looking value also probes the boolean form',
    );

    // Only the FIRST colon splits, so a value may itself contain colons.
    t.same(
        whereAttrContains('attrs', 'note:a:b'),
        {
            [Op.or]: [
                { attrs: { [Op.contains]: { note: 'a:b' } } },
                { attrs: { [Op.contains]: { note: ['a:b'] } } },
            ],
        },
        'splits on the first colon only',
    );
});
