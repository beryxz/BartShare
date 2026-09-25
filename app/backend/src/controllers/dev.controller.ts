import { FastifyInstance } from 'fastify';
import { Op, OrderItem } from 'sequelize';
import { Static } from 'typebox';
import { health, mapEvaluatorError } from '../bart/evaluator.client';
import { APP_LIMITS } from '../config';
import { scenarioById } from '../dev/scenarios';
import {
    FixtureInvalidError,
    isDatabaseEmpty,
    listScenarios,
    resetDatabase,
    seedScenario,
} from '../dev/seed.service';
import { LogEvent, User } from '../models/models';
import {
    DevGetEventsSchema,
    DevGetScenariosSchema,
    DevGetStatusSchema,
    DevPostResetSchema,
    DevPostSeedSchema,
    LogEventType,
} from '../schemas/dev.schema';
import { returnPaginatedResults } from '../utils/controllers.utils';
import { logEvent } from '../utils/events.utils';
import { log } from '../utils/general.utils';
import {
    FastifyReplyTypebox,
    FastifyRequestTypebox,
} from '../utils/typebox.utils';

async function get_scenarios(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof DevGetScenariosSchema>,
    reply: FastifyReplyTypebox<typeof DevGetScenariosSchema>,
) {
    return reply.status(200).send({ scenarios: listScenarios() });
}

async function get_events(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof DevGetEventsSchema>,
    reply: FastifyReplyTypebox<typeof DevGetEventsSchema>,
) {
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.dev.eventsPageSize;
    // `occurred_at` is TEXT, so this sorts lexicographically; that matches
    // chronological order only while `logEvent()` writes fixed-width UTC ISO.
    const order: OrderItem[] = [
        ['occurred_at', 'DESC'],
        ['id', 'ASC'],
    ];

    const { count, rows } = await LogEvent.findAndCountAll({
        limit: pageSize,
        offset: pageSize * (pageNum - 1),
        order,
    });

    // One batched lookup instead of an eager-load `include`, which would turn
    // a missing party into a row this endpoint has to special-case anyway.
    const userIds = [
        ...new Set(
            rows
                .map(row => row.UserId)
                .filter((id): id is string => id !== null && id !== undefined),
        ),
    ];
    const parties = userIds.length
        ? await User.findAll({
              where: { id: { [Op.in]: userIds } },
              attributes: ['id', 'attrs'],
          })
        : [];
    const usernames = new Map(
        parties.map(party => [party.id, String(party.attrs.username ?? '')]),
    );

    const events = rows.map(row => ({
        id: row.id,
        type: row.type,
        data: row.data,
        occurred_at: row.occurred_at,
        userId: row.UserId ?? null,
        username: row.UserId ? (usernames.get(row.UserId) ?? null) : null,
    }));

    return reply.status(200).send(
        returnPaginatedResults<Static<typeof LogEventType>>(events, count, {
            size: pageSize,
            number: pageNum,
        }),
    );
}

async function post_seed(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof DevPostSeedSchema>,
    reply: FastifyReplyTypebox<typeof DevPostSeedSchema>,
) {
    const scenario = scenarioById(request.body.scenario);
    if (scenario === undefined) return reply.status(404).send();

    if (!(await isDatabaseEmpty()))
        return reply
            .status(409)
            .send({ errors: ['The database is not empty: reset it first'] });

    try {
        const created = await seedScenario(this.db, scenario);
        await logEvent('dev.seed', null, { scenario: scenario.id });
        return reply.status(200).send({ scenario: scenario.id, created });
    } catch (error) {
        // A fixture that fails its own validation is a bug in this repo, not
        // something the caller could have sent differently: 500, never 400.
        if (error instanceof FixtureInvalidError) {
            log(`[dev.post_seed] invalid fixture: ${error.errors.join('; ')}`);
            return reply.status(500).send({ errors: error.errors });
        }
        // Unauthenticated route: an evaluator outage must not leak
        // EVALUATOR_URL (see mapEvaluatorError).
        const mapped = mapEvaluatorError(error);
        if (mapped === null) throw error;
        log(`[dev.post_seed] ${(error as Error).message}`);
        return reply.status(mapped.status).send({ errors: mapped.errors });
    }
}

async function post_reset(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof DevPostResetSchema>,
    reply: FastifyReplyTypebox<typeof DevPostResetSchema>,
) {
    const deleted = await resetDatabase(this.db);
    // Logged after the truncate on purpose: logging first would write a row
    // the truncate then deletes, which reads as an event that never happened.
    await logEvent('dev.reset', null, deleted);
    return reply.status(200).send({ deleted });
}

type ServiceProbe = {
    name: 'database' | 'evaluator';
    status: 'up' | 'down';
    latencyMs: number | null;
    detail: string | null;
};

/**
 * Comfortably under `EVALUATOR_TIMEOUT_MS`, so this endpoint's worst case is
 * bounded by the shorter timeout. Also bounds the database probe, which
 * otherwise inherits whatever default `pg`/Sequelize uses.
 */
const PROBE_TIMEOUT_MS = 5000;

/**
 * Races a promise against a timer that rejects, so a caller that never
 * settles cannot hang the request. The timer is cleared as soon as `promise`
 * settles either way, otherwise a fast probe leaves a stray timer alive for
 * `ms`, rejecting a promise nothing is listening to anymore.
 */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`timed out after ${ms}ms`));
        }, ms);
        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/**
 * Times one dependency probe, turning a throw into a reported outage instead
 * of a failed request.
 *
 * `detail` is always the caller's constant, never the caught error's
 * message: this route is public, and the error can embed `EVALUATOR_URL`.
 */
async function probe(
    name: ServiceProbe['name'],
    downDetail: string,
    run: () => Promise<unknown>,
): Promise<ServiceProbe> {
    const startedAt = performance.now();
    try {
        await withDeadline(run(), PROBE_TIMEOUT_MS);
        return {
            name,
            status: 'up',
            latencyMs: Math.round(performance.now() - startedAt),
            detail: null,
        };
    } catch (error) {
        log(`[dev.get_status] ${name} is down: ${(error as Error).message}`);
        return { name, status: 'down', latencyMs: null, detail: downDetail };
    }
}

async function get_status(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof DevGetStatusSchema>,
    reply: FastifyReplyTypebox<typeof DevGetStatusSchema>,
) {
    // Parallel and caught separately: one dependency being down must not
    // hide the state of the other.
    const services = await Promise.all([
        probe('database', 'The database is unreachable', () =>
            this.db.authenticate(),
        ),
        probe('evaluator', 'The evaluator service is unreachable', () =>
            health(),
        ),
    ]);

    return reply.status(200).send({ services });
}

export default { get_events, get_scenarios, post_seed, post_reset, get_status };
