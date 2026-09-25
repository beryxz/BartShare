'use strict';

// Subtests run in file order and share one database: later ones read state
// earlier ones left behind (e.g. the 409 test's User.count() === 3).
// Inserting one mid-file, not just at the end, can break an assertion below.

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import config from '../../src/config';
import { scenarioById } from '../../src/dev/scenarios';
import { Group, LogEvent, Resource, User } from '../../src/models/models';
import { bootApi } from '../support/api-harness';
import {
    startFakeEvaluator,
    withFakeEvaluator,
} from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());
});
t.after(async () => {
    await apiServer.close();
    await dbInstance.close();
});

const seed = (scenario: string) =>
    withFakeEvaluator(
        () => ({ valid: true }),
        () =>
            apiServer.inject({
                method: 'POST',
                url: '/api/v1/dev/seed',
                payload: { scenario },
            }),
    );

t.test('GET /dev/scenarios lists the catalogue', async t => {
    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/dev/scenarios',
    });

    t.equal(response.statusCode, 200, 'status code');
    const body = response.json();
    t.same(
        body.scenarios.map((s: { id: string }) => s.id),
        ['ex1', 'ex2', 'ex3', 'ex4', 'ex5'],
        'ids in catalogue order',
    );
    t.same(
        body.scenarios[2].counts,
        { users: 3, resources: 3, connections: 1, groups: 0 },
        'counts survive serialisation',
    );
    t.ok(body.scenarios[0].title.length > 0, 'title survives serialisation');
});

t.test('POST /dev/seed loads a scenario into an empty database', async t => {
    const response = await seed('ex3');

    t.equal(response.statusCode, 200, 'status code');
    t.same(
        response.json(),
        {
            scenario: 'ex3',
            created: { users: 3, resources: 3, connections: 1, groups: 0 },
        },
        'body reports what was created',
    );
    t.equal(await User.count(), 3, 'parties landed');
});

t.test('POST /dev/seed is a 409 once data exists', async t => {
    const response = await seed('ex1');

    t.equal(response.statusCode, 409, 'status code');
    t.match(
        response.json().errors[0],
        /not empty/i,
        'the body says why, since 409 here is not the empty-bodied kind',
    );
    t.equal(await User.count(), 3, 'the existing scenario is untouched');
    t.equal(
        await Resource.count(),
        3,
        'and no resources from the refused scenario leaked in',
    );
});

t.test('POST /dev/reset empties the database and reports counts', async t => {
    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/dev/reset',
    });

    t.equal(response.statusCode, 200, 'status code');
    t.same(
        response.json().deleted,
        // logEvents is 1, not 0: the earlier POST /dev/seed logged a
        // 'dev.seed' event, and this reset counts it as data before wiping it.
        { users: 3, resources: 3, groups: 0, logEvents: 1 },
        'body reports what was deleted',
    );
    t.equal(await User.count(), 0, 'nothing left');
});

t.test('POST /dev/reset on an empty database is a 200, idempotent', async t => {
    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/dev/reset',
    });

    t.equal(response.statusCode, 200, 'idempotent, never a 409');
    t.same(response.json().deleted, {
        users: 0,
        resources: 0,
        groups: 0,
        // Not 0: the previous reset logs its own 'dev.reset' event after
        // truncating, so that row survives to be counted and wiped here.
        logEvents: 1,
    });
});

t.test('a leftover group alone blocks seeding', async t => {
    const group = await Group.create({ name: 'leftover', description: 'd' });

    const response = await seed('ex1');
    t.equal(response.statusCode, 409, 'groups count as data');

    await group.destroy();
});

t.test('POST /dev/seed with an unknown scenario is a 404', async t => {
    const response = await seed('ex99');
    t.equal(response.statusCode, 404, 'status code');
});

t.test('POST /dev/seed with a malformed body is a 400', async t => {
    const response = await apiServer.inject({
        method: 'POST',
        url: '/api/v1/dev/seed',
        payload: {},
    });
    t.equal(response.statusCode, 400, 'schema validation rejects it');
});

t.test(
    'an unreachable evaluator is a 503 and leaves nothing behind',
    async t => {
        const previousUrl = config.EVALUATOR_URL;
        config.EVALUATOR_URL = 'http://127.0.0.1:1';

        // try/finally, not a plain assignment: an assertion throwing above
        // would otherwise leave EVALUATOR_URL poisoned for every later subtest.
        try {
            const response = await apiServer.inject({
                method: 'POST',
                url: '/api/v1/dev/seed',
                payload: { scenario: 'ex1' },
            });

            t.equal(response.statusCode, 503, 'status code, not 400');
            t.notMatch(
                JSON.stringify(response.json()),
                /127\.0\.0\.1:1\b/,
                'the evaluator URL is not in the body',
            );
            t.equal(await User.count(), 0, 'the database is still empty');
        } finally {
            config.EVALUATOR_URL = previousUrl;
        }
    },
);

t.test('seeding needs no session cookie', async t => {
    // With an empty database there is no user to be, so a cookie-protected
    // seed endpoint could never be called.
    const response = await seed('ex1');
    t.equal(response.statusCode, 200, 'no cookie, still allowed');

    await apiServer.inject({ method: 'POST', url: '/api/v1/dev/reset' });
});

t.test('GET /dev/events serves the log with its page metadata', async t => {
    // Cleared and reset rather than trusting the subtests above: a reset
    // leaves exactly one row, since resetDatabase truncates LogEvents and
    // the controller logs `dev.reset` only afterwards.
    await LogEvent.destroy({ where: {} });
    await apiServer.inject({ method: 'POST', url: '/api/v1/dev/reset' });

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/dev/events',
    });

    t.equal(response.statusCode, 200, 'status code');
    const body = response.json();
    t.equal(body.page.number, 1, 'defaults to page 1');
    t.equal(body.page.size, 50, 'page size from APP_LIMITS');
    t.equal(body.page.totalElements, 1, 'only the reset row survives a reset');
    t.equal(body.data[0].type, 'dev.reset', 'and it is that row');
});

t.test('GET /dev/events resolves the party behind a row', async t => {
    await LogEvent.destroy({ where: {} });

    const party = await User.create({
        attrs: { username: 'alice' },
        rules: [],
    });

    await LogEvent.create({
        type: 'test.system',
        UserId: undefined,
        data: null,
        occurred_at: '2026-01-01T00:00:00.000Z',
    });
    await LogEvent.create({
        type: 'test.party',
        UserId: party.id,
        data: { k: 'v' },
        occurred_at: '2026-01-02T00:00:00.000Z',
    });

    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/dev/events',
    });
    const rows = response.json().data as {
        type: string;
        data: unknown;
        userId: string | null;
        username: string | null;
    }[];

    const system = rows.find(r => r.type === 'test.system');
    t.same(
        { userId: system?.userId, username: system?.username },
        { userId: null, username: null },
        'a system event has neither id nor name',
    );

    const live = rows.find(r => r.type === 'test.party');
    t.same(
        { userId: live?.userId, username: live?.username },
        { userId: party.id, username: 'alice' },
        'a live party resolves to its username',
    );
    t.same(live?.data, { k: 'v' }, 'the data payload survives serialisation');

    await User.destroy({ where: {} });
    await LogEvent.destroy({ where: {} });
});

t.test(
    'deleting a party anonymises its rows rather than removing them',
    async t => {
        await LogEvent.destroy({ where: {} });

        const party = await User.create({
            attrs: { username: 'departing' },
            rules: [],
        });
        await LogEvent.create({
            type: 'test.byParty',
            UserId: party.id,
            data: null,
            occurred_at: '2026-01-05T00:00:00.000Z',
        });

        await party.destroy({ force: true });

        const response = await apiServer.inject({
            method: 'GET',
            url: '/api/v1/dev/events',
        });
        const rows = response.json().data as {
            type: string;
            userId: string | null;
            username: string | null;
        }[];
        const orphan = rows.find(r => r.type === 'test.byParty');

        // LogEvents_UserId_fkey is ON DELETE SET NULL: the row survives its
        // party and reads as a system event from here on.
        t.ok(orphan, 'the row outlives the party');
        t.same(
            { userId: orphan?.userId, username: orphan?.username },
            { userId: null, username: null },
            'and reads as a system row afterwards',
        );

        await LogEvent.destroy({ where: {} });
    },
);

t.test('GET /dev/events pages', async t => {
    await LogEvent.destroy({ where: {} });
    for (let i = 0; i < 51; i++)
        await LogEvent.create({
            type: `test.bulk.${i}`,
            UserId: undefined,
            data: null,
            // Zero-padded so the lexicographic sort on this TEXT column is
            // the numeric one this assertion assumes.
            occurred_at: `2026-02-01T00:00:${String(i).padStart(2, '0')}.000Z`,
        });

    const first = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/dev/events?page=1',
    });
    const second = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/dev/events?page=2',
    });

    t.equal(first.json().data.length, 50, 'a full first page');
    t.equal(second.json().data.length, 1, 'the remainder on page 2');
    t.equal(second.json().page.totalElements, 51, 'total is the row count');
    t.equal(second.json().page.totalPages, 2, 'two pages');
    t.equal(first.json().data[0].type, 'test.bulk.50', 'newest is first');

    await LogEvent.destroy({ where: {} });
});

t.test('GET /dev/events needs no session cookie', async t => {
    const response = await apiServer.inject({
        method: 'GET',
        url: '/api/v1/dev/events',
    });
    t.equal(response.statusCode, 200, 'no cookie, still allowed');
});

t.test('GET /dev/status reports both dependencies up', async t => {
    const fake = await startFakeEvaluator();
    const previousUrl = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    try {
        const response = await apiServer.inject({
            method: 'GET',
            url: '/api/v1/dev/status',
        });

        t.equal(response.statusCode, 200, 'status code');
        const services = response.json().services as {
            name: string;
            status: string;
            latencyMs: number | null;
            detail: string | null;
        }[];
        t.same(
            services.map(s => s.name).sort(),
            ['database', 'evaluator'],
            'both dependencies reported',
        );
        t.ok(
            services.every(s => s.status === 'up'),
            'both up',
        );
        t.ok(
            services.every(s => typeof s.latencyMs === 'number'),
            'an up service carries a latency',
        );
        t.ok(
            services.every(s => s.detail === null),
            'an up service carries no detail',
        );
    } finally {
        config.EVALUATOR_URL = previousUrl;
        await fake.close();
    }
});

t.test('GET /dev/status is a 200 when the evaluator is down', async t => {
    const previousUrl = config.EVALUATOR_URL;
    config.EVALUATOR_URL = 'http://127.0.0.1:1';

    // Same reason as the seed 503 test above: config is shared state that
    // must not stay poisoned if an assertion throws here.
    try {
        const response = await apiServer.inject({
            method: 'GET',
            url: '/api/v1/dev/status',
        });

        t.equal(response.statusCode, 200, 'an outage is data, not an error');
        const services = response.json().services as {
            name: string;
            status: string;
            latencyMs: number | null;
            detail: string | null;
        }[];
        const evaluator = services.find(s => s.name === 'evaluator');
        t.equal(evaluator?.status, 'down', 'the evaluator is reported down');
        t.equal(evaluator?.latencyMs, null, 'a down service has no latency');
        t.ok(evaluator?.detail, 'a down service carries a detail message');
        t.notMatch(
            JSON.stringify(response.json()),
            /127\.0\.0\.1:1\b/,
            'the evaluator URL is not in the body',
        );

        const database = services.find(s => s.name === 'database');
        t.equal(database?.status, 'up', 'one outage does not mask the other');
    } finally {
        config.EVALUATOR_URL = previousUrl;
    }
});

t.test('GET /dev/status needs no session cookie', async t => {
    const fake = await startFakeEvaluator();
    const previousUrl = config.EVALUATOR_URL;
    config.EVALUATOR_URL = fake.url;

    try {
        const response = await apiServer.inject({
            method: 'GET',
            url: '/api/v1/dev/status',
        });
        t.equal(response.statusCode, 200, 'no cookie, still allowed');
    } finally {
        config.EVALUATOR_URL = previousUrl;
        await fake.close();
    }
});

t.test(
    'GET /dev/status reports a probe down, not a hung request, once it exceeds its deadline',
    { timeout: 15000 },
    async t => {
        // PROBE_TIMEOUT_MS (5s) has no env knob, so this genuinely waits for
        // it; authenticate stands in for a connection that hangs, not refuses.
        const originalAuthenticate = dbInstance.authenticate;
        dbInstance.authenticate = () => new Promise(() => {});

        const fake = await startFakeEvaluator();
        const previousUrl = config.EVALUATOR_URL;
        config.EVALUATOR_URL = fake.url;

        try {
            const startedAt = Date.now();
            const response = await apiServer.inject({
                method: 'GET',
                url: '/api/v1/dev/status',
            });
            const elapsedMs = Date.now() - startedAt;

            t.equal(
                response.statusCode,
                200,
                'a timed-out probe is still a 200',
            );
            t.ok(
                elapsedMs < 9000,
                'the request settles near the 5s deadline, not the hung promise',
            );

            const services = response.json().services as {
                name: string;
                status: string;
                latencyMs: number | null;
                detail: string | null;
            }[];
            const database = services.find(s => s.name === 'database');
            t.equal(
                database?.status,
                'down',
                'the deadline reports the probe down',
            );
            t.equal(database?.latencyMs, null, 'a down service has no latency');
            t.ok(database?.detail, 'a down service carries a detail message');

            const evaluator = services.find(s => s.name === 'evaluator');
            t.equal(
                evaluator?.status,
                'up',
                'the other probe is unaffected by the hung one',
            );
        } finally {
            dbInstance.authenticate = originalAuthenticate;
            config.EVALUATOR_URL = previousUrl;
            await fake.close();
        }
    },
);

t.test('POST /dev/seed writes a fixture group and its memberships', async t => {
    // Reset first rather than trusting the subtests above, since this one is
    // about an empty-database seed and runs after several that write parties.
    await apiServer.inject({ method: 'POST', url: '/api/v1/dev/reset' });

    const response = await seed('ex4');
    t.equal(response.statusCode, 200, 'status code');
    t.same(
        response.json().created,
        { users: 4, resources: 5, connections: 0, groups: 1 },
        'the group is reported as created',
    );

    const fixture = scenarioById('ex4')!;
    const groupId = fixture.groups![0].id;
    // The id the conditions quote, not a generated one: a group written under
    // any other id leaves those conditions matching nobody, silently.
    t.ok(await Group.findByPk(groupId), 'the group landed under the quoted id');

    const parties = await User.findAll();
    const memberships = await Promise.all(
        parties.map(party => party.getGroups()),
    );
    t.ok(
        memberships.every(groups => groups.some(g => g.id === groupId)),
        'every party the fixture lists joined it',
    );

    await apiServer.inject({ method: 'POST', url: '/api/v1/dev/reset' });
});
