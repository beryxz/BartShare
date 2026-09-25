'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import config from '../../src/config';
import { Resource, User } from '../../src/models/models';

const EVALUATOR = process.env.E2E_EVALUATOR_URL;

if (!EVALUATOR) {
    // plan(0, reason) skips a whole file; bare t.skip fails --typecheck.
    t.plan(
        0,
        'set E2E_EVALUATOR_URL to run the end-to-end oracle against a real bart-wrapper',
    );
} else {
    let dbInstance: Sequelize;
    let apiServer: FastifyInstance;
    let john: User;
    let mary: User;
    let david: User;
    let adsNotes: Resource;
    let previousUrl: string;

    const UNDERGRAD = {
        studyLevel: 'undergraduate',
        degreeProgram: 'cs',
        university: 'unifi',
    };

    t.before(async () => {
        ({ db: dbInstance, api: apiServer } = await bootApi());
        previousUrl = config.EVALUATOR_URL;
        config.EVALUATOR_URL = EVALUATOR;

        john = await User.create({
            attrs: { username: 'john', ...UNDERGRAD, enrollment: '2024' },
            rules: [
                '(resource:(type:"lectureNotes")(course:"programming")' +
                    '(teacher:"smith")(year:"24/25"),' +
                    ' exchange:(to:me, resource:(type:"lectureNotes"), from:requester))',
            ],
        });
        mary = await User.create({
            attrs: { username: 'mary', ...UNDERGRAD, enrollment: '2023' },
            rules: [
                '(resource:(type:"lectureNotes")(course:"ads")(teacher:"doe")(year:"23/24"),' +
                    ' exchange:(to:me, resource:(type:"lectureNotes"),' +
                    ' from:(any:(studyLevel:"undergraduate")(degreeProgram:"cs")' +
                    '(university:"unifi")))' +
                    ' and (to:me, resource:(type:"exercises"),' +
                    ' from:(any:(studyLevel:"undergraduate")(degreeProgram:"cs")' +
                    '(university:"unifi"))))',
            ],
        });
        david = await User.create({
            attrs: { username: 'david', ...UNDERGRAD, enrollment: '2023' },
            rules: [
                '(resource:(type:"exercises")(course:"calculus")' +
                    '(teacher:"brown")(year:"23/24"))',
            ],
        });

        adsNotes = await Resource.create({
            attrs: {
                type: 'lectureNotes',
                course: 'ads',
                teacher: 'doe',
                year: '23/24',
            },
            metadata: { name: 'ADS lecture notes' },
            UserId: mary.id,
        });
    });
    t.after(async () => {
        config.EVALUATOR_URL = previousUrl;
        await apiServer.close();
        await dbInstance.close();
    });

    t.test(
        'the closure reaches david, exactly as the handwritten scenario does',
        async t => {
            t.plan(4);

            const response = await apiServer.inject({
                method: 'GET',
                url: `/api/v1/resources/${adsNotes.id}/access`,
                cookies: { user: john.id },
            });
            const body = response.json();

            t.equal(response.statusCode, 200, 'status code');
            t.same(
                body.evaluation.parties.slice().sort(),
                [john.id, mary.id, david.id].sort(),
                'three parties (john and mary seeded, david pulled in by the any: patterns)',
            );
            // Real engine, not the fake: a known-correct verdict.
            t.equal(body.permitted, true, 'the chain closes: permit');
            // A permit with an empty chain is what a party silently dropped
            // from the closure looks like: its from/to slot reads as satisfied.
            t.ok(
                body.evaluation.requests.length > 0,
                'a real exchange chain was satisfied, not an empty one',
            );
        },
    );

    t.test('the evaluator accepts the assembled scenario', async t => {
        t.plan(2);

        const response = await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${adsNotes.id}/access`,
            cookies: { user: john.id },
        });
        const body = response.json();

        t.equal(response.statusCode, 200, 'assembly produced valid .bart');
        t.match(
            body.evaluation.scenario,
            /party:\(userId:/,
            'the echoed scenario is what we sent',
        );
    });

    t.test('a party outside the closure does not appear', async t => {
        t.plan(1);
        const outsider = await User.create({
            attrs: { username: 'outsider', university: 'other' },
            rules: [],
        });

        const response = await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${adsNotes.id}/access`,
            cookies: { user: john.id },
        });

        t.notOk(
            response.json().evaluation.parties.includes(outsider.id),
            'the closure narrowed rather than loading everyone',
        );
    });

    t.test(
        "the paper's own request line evaluates against the real engine",
        async t => {
            t.plan(2);

            // The paper's ex3 EnrichedRequest, verbatim. The row path can't
            // express it: it always targets from:(any:(userId:…)) instead.
            const response = await apiServer.inject({
                method: 'POST',
                url: '/api/v1/resources/access',
                cookies: { user: john.id },
                payload: {
                    resource: { type: 'lectureNotes', course: 'ads' },
                    from: { quantifier: 'any', attrs: UNDERGRAD },
                },
            });
            const body = response.json();

            t.equal(response.statusCode, 200, 'status code');
            t.equal(body.permitted, true, "the paper's scenario permits");
        },
    );
}
