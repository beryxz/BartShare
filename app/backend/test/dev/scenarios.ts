'use strict';

import t from 'tap';
import { validateAttrs } from '../../src/bart/reserved';
import { countsOf, SCENARIOS, scenarioById } from '../../src/dev/scenarios';

// No database and no evaluator: these assertions are about the fixtures being
// coherent as data. A fixture that names an owner nobody defines, or reuses a
// key, fails here rather than as a foreign-key error halfway through a seed.

const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

t.test('the registry holds every scenario', async t => {
    t.same(
        SCENARIOS.map(s => s.id),
        ['ex1', 'ex2', 'ex3', 'ex4', 'ex5'],
        'ids, in catalogue order',
    );
    t.equal(scenarioById('ex2')?.id, 'ex2', 'lookup by id');
    t.equal(scenarioById('nope'), undefined, 'unknown id is undefined');
});

t.test('every scenario is coherent', async t => {
    for (const scenario of SCENARIOS) {
        t.ok(scenario.title.length > 0, `${scenario.id}: has a title`);
        t.ok(scenario.summary.length > 0, `${scenario.id}: has a summary`);

        const userKeys = scenario.users.map(u => u.key);
        t.same(
            [...new Set(userKeys)],
            userKeys,
            `${scenario.id}: user keys are unique`,
        );

        for (const user of scenario.users) {
            t.same(
                validateAttrs(user.attrs),
                [],
                `${scenario.id}: ${user.key} attrs are expressible in Bart`,
            );
            t.ok(
                typeof user.attrs.username === 'string',
                `${scenario.id}: ${user.key} has a username`,
            );
        }

        const resourceKeys = scenario.resources.map(r => r.key);
        t.same(
            [...new Set(resourceKeys)],
            resourceKeys,
            `${scenario.id}: resource keys are unique`,
        );

        for (const resource of scenario.resources) {
            t.ok(
                userKeys.includes(resource.ownerKey),
                `${scenario.id}: ${resource.key} is owned by a defined party`,
            );
            t.same(
                validateAttrs(resource.attrs),
                [],
                `${scenario.id}: ${resource.key} attrs are expressible in Bart`,
            );
            t.ok(
                typeof resource.metadata.name === 'string' &&
                    resource.metadata.name.length > 0,
                `${scenario.id}: ${resource.key} has a display name`,
            );
        }

        for (const [a, b] of scenario.connections) {
            t.ok(
                userKeys.includes(a) && userKeys.includes(b),
                `${scenario.id}: connection ${a}-${b} names defined parties`,
            );
            t.not(a, b, `${scenario.id}: no self-connection`);
        }

        const groups = scenario.groups ?? [];
        const groupIds = groups.map(g => g.id);
        t.same(
            [...new Set(groupIds)],
            groupIds,
            `${scenario.id}: group ids are unique`,
        );

        for (const group of groups) {
            // `Group.id` validates `isUUID: 4` and the fixture sets it by hand,
            // so a typo here would surface as a write failure mid-seed.
            t.match(group.id, UUID_V4_RE, `${scenario.id}: ${group.id} is v4`);
            t.ok(
                group.name.length > 0 && group.description.length > 0,
                `${scenario.id}: ${group.id} has a name and a description`,
            );
            for (const memberKey of group.memberKeys) {
                t.ok(
                    userKeys.includes(memberKey),
                    `${scenario.id}: ${group.id} member ${memberKey} is defined`,
                );
            }
        }
    }
});

t.test('a group id a rule quotes is the id that gets written', async t => {
    const ex4 = scenarioById('ex4')!;
    const groupId = ex4.groups![0].id;
    const quoting = ex4.users.flatMap(user =>
        user.rules.filter(rule => rule.includes(groupId)),
    );
    t.ok(quoting.length > 0, 'the fixture quotes its own group id');
});

t.test('counts describe the fixture', async t => {
    t.same(
        countsOf(scenarioById('ex3')!),
        { users: 3, resources: 3, connections: 1, groups: 0 },
        'ex3 counts',
    );
    t.same(
        countsOf(scenarioById('ex1')!),
        { users: 3, resources: 2, connections: 1, groups: 0 },
        'ex1 counts',
    );
    t.same(
        countsOf(scenarioById('ex4')!),
        { users: 4, resources: 5, connections: 0, groups: 1 },
        'ex4 counts, with its group',
    );
});
