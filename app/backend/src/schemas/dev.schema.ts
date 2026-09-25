import { Type } from '@fastify/type-provider-typebox';
import {
    ConflictReasonErrorResponse,
    InternalServerErrorResponse,
    NotFoundErrorResponse,
    paginatedResults,
    ServiceUnavailableErrorResponse,
    TypeJsonObject,
    ValidationErrorResponse,
} from '../utils/schemas.utils';

const ScenarioCountsType = Type.Object({
    users: Type.Integer(),
    resources: Type.Integer(),
    connections: Type.Integer(),
    groups: Type.Integer(),
});

export const ScenarioType = Type.Object({
    id: Type.String(),
    title: Type.String(),
    summary: Type.String(),
    counts: ScenarioCountsType,
});

/**
 * Not `paginatedResults`: the catalogue is fixed and tiny, and a `page`
 * envelope would advertise a page size that doesn't exist. Follows
 * `FacetsResponse`'s named-wrapper-key convention in `resources.schema.ts`.
 */
export const DevGetScenariosSchema = {
    tags: ['dev'],
    summary: 'List seed scenarios',
    description: 'The canned scenarios POST /dev/seed can load',
    security: [],
    response: { 200: Type.Object({ scenarios: Type.Array(ScenarioType) }) },
} as const;

export const DevPostSeedSchema = {
    tags: ['dev'],
    summary: 'Seed a scenario',
    description:
        'Loads a canned scenario. Only works on an empty database: wiping is ' +
        'always an explicit POST /dev/reset, never a side effect of seeding.',
    security: [],
    body: Type.Object({ scenario: Type.String({ minLength: 1 }) }),
    response: {
        200: Type.Object({
            scenario: Type.String(),
            created: ScenarioCountsType,
        }),
        400: ValidationErrorResponse,
        404: NotFoundErrorResponse,
        409: ConflictReasonErrorResponse,
        500: InternalServerErrorResponse,
        503: ServiceUnavailableErrorResponse,
    },
} as const;

export const DevPostResetSchema = {
    tags: ['dev'],
    summary: 'Reset the database',
    description:
        'Deletes every party, resource, group, connection and log event. ' +
        'Idempotent and never an error; counts describe what existed at the ' +
        'moment of the call',
    security: [],
    response: {
        200: Type.Object({
            deleted: Type.Object({
                users: Type.Integer(),
                resources: Type.Integer(),
                groups: Type.Integer(),
                logEvents: Type.Integer(),
            }),
        }),
        500: InternalServerErrorResponse,
    },
} as const;

/**
 * One `LogEvents` row, as stored.
 *
 * `userId`/`username` are independent nullables. A third shape, `userId`
 * set with `username` null, is never written but is observable: a deletion
 * landing between `get_events`'s two separate queries produces it.
 */
export const LogEventType = Type.Object({
    id: Type.String(),
    type: Type.String(),
    data: Type.Union([TypeJsonObject(), Type.Null()]),
    occurred_at: Type.String(),
    userId: Type.Union([Type.String(), Type.Null()]),
    username: Type.Union([Type.String(), Type.Null()]),
});

/**
 * Paginated, unlike `DevGetScenariosSchema` above: that catalogue is fixed
 * and tiny, but this table is unbounded, so the envelope is real here.
 */
export const DevGetEventsSchema = {
    tags: ['dev'],
    summary: 'List log events',
    description:
        'Every recorded event, newest first. Deliberately unfiltered: this ' +
        'is a raw inspection view. POST /dev/reset truncates the table, so ' +
        'it is a session log rather than durable history.',
    security: [],
    querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1 })),
    }),
    response: { 200: paginatedResults(LogEventType) },
} as const;

const ServiceStatusType = Type.Object({
    name: Type.Union([Type.Literal('database'), Type.Literal('evaluator')]),
    status: Type.Union([Type.Literal('up'), Type.Literal('down')]),
    latencyMs: Type.Union([Type.Number(), Type.Null()]),
    detail: Type.Union([Type.String(), Type.Null()]),
});

export const DevGetStatusSchema = {
    tags: ['dev'],
    summary: 'Probe the backend dependencies',
    description:
        'Reports whether the database and the evaluator are reachable. ' +
        'Always answers 200: a down dependency is a finding in the body and ' +
        'never an error status, because a report that fails during an outage ' +
        'is useless. `detail` is a fixed message and never echoes ' +
        'EVALUATOR_URL, since this route is public.',
    security: [],
    response: { 200: Type.Object({ services: Type.Array(ServiceStatusType) }) },
} as const;
