import { Type } from '@fastify/type-provider-typebox';
import { GroupType } from './groups.schema';
import { FacetsResponse, ResourceWithUserType } from './resources.schema';
import { UserType } from './users.schema';
import {
    ConflictErrorResponse,
    GeneralErrorResponse,
    InternalServerErrorResponse,
    NoContentResponse,
    NotAuthenticatedErrorResponse,
    NotAuthorizedErrorResponse,
    NotFoundErrorResponse,
    paginatedResults,
    ServiceUnavailableErrorResponse,
    TypeJsonObject,
    ValidationErrorResponse,
} from '../utils/schemas.utils';

export const MeGetSchema = {
    tags: ['me'],
    summary: 'Get user information',
    description: 'Get information of the authenticated user',
    security: [{ session_cookie: [] }],
    response: {
        200: UserType,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const MePatchSchema = {
    tags: ['me'],
    summary: 'Modify user information',
    description: 'Modify the authenticated user',
    security: [{ session_cookie: [] }],
    body: Type.Partial(
        Type.Object({
            attrs: TypeJsonObject(),
            rules: Type.Array(Type.String()),
        }),
    ),
    response: {
        200: UserType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
        500: InternalServerErrorResponse,
        503: ServiceUnavailableErrorResponse,
    },
} as const;

export const MeDeleteSchema = {
    tags: ['me'],
    summary: 'Delete user',
    description:
        'Delete the authenticated user, its resources, connections and group memberships',
    security: [{ session_cookie: [] }],
    response: {
        200: UserType,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const MeGetResourcesSchema = {
    tags: ['me'],
    summary: "Get the user's resources",
    description: 'Get the resources owned by the authenticated user',
    security: [{ session_cookie: [] }],
    querystring: Type.Partial(
        Type.Object({
            page: Type.Integer({ minimum: 1 }),
            name: Type.String(),
            attr: Type.String(),
        }),
    ),
    response: {
        200: paginatedResults(ResourceWithUserType),
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
    },
} as const;

export const MeGetResourceFacetsSchema = {
    tags: ['me'],
    summary: "Get the user's resource filter facets",
    description:
        'The distinct attribute vocabulary across the resources owned by the ' +
        'authenticated user, honouring the same filters as the list endpoint. ' +
        'Reserved keys are excluded.',
    security: [{ session_cookie: [] }],
    querystring: Type.Partial(
        Type.Object({
            name: Type.String(),
            attr: Type.String(),
        }),
    ),
    response: {
        200: FacetsResponse,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
    },
} as const;

export const MeGetConnectionsSchema = {
    tags: ['me'],
    summary: "Get the user's connections",
    description: 'Get the users connected to the authenticated user',
    security: [{ session_cookie: [] }],
    querystring: Type.Partial(
        Type.Object({
            page: Type.Integer({ minimum: 1 }),
            username: Type.String(),
        }),
    ),
    response: {
        200: paginatedResults(UserType),
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const MePostConnectionSchema = {
    tags: ['me'],
    summary: 'Add a connection',
    description: 'Connect the authenticated user to another user, both ways',
    security: [{ session_cookie: [] }],
    params: Type.Object({ userId: Type.String({ format: 'uuid' }) }),
    response: {
        204: NoContentResponse,
        400: GeneralErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
        409: ConflictErrorResponse,
    },
} as const;

export const MeDeleteConnectionSchema = {
    tags: ['me'],
    summary: 'Remove a connection',
    description:
        'Disconnect the authenticated user from another user, both ways',
    security: [{ session_cookie: [] }],
    params: Type.Object({ userId: Type.String({ format: 'uuid' }) }),
    response: {
        204: NoContentResponse,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const MeGetSharedSchema = {
    tags: ['me'],
    summary: 'Get resources shared with me',
    description:
        'Every resource the caller does not own that the engine permits right ' +
        'now. There are no stored grants, so this is a live evaluation per ' +
        'candidate. `scan` reports how much of the corpus was considered.',
    security: [{ session_cookie: [] }],
    querystring: Type.Partial(
        Type.Object({
            page: Type.Integer({ minimum: 1 }),
            name: Type.String(),
            attr: Type.String(),
        }),
    ),
    response: {
        // Flat, not Type.Intersect: it compiles to `allOf`, and
        // fast-json-stringify's handling of that can silently strip keys.
        200: Type.Object({
            data: Type.Array(ResourceWithUserType),
            page: Type.Object({
                size: Type.Number(),
                totalElements: Type.Number(),
                totalPages: Type.Number(),
                number: Type.Number(),
            }),
            scan: Type.Object({
                considered: Type.Integer(),
                total: Type.Integer(),
                truncated: Type.Boolean(),
            }),
        }),
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        500: InternalServerErrorResponse,
        503: ServiceUnavailableErrorResponse,
    },
} as const;

export const MeGetContextSchema = {
    tags: ['me'],
    summary: 'Get my derived context',
    description:
        'What the evaluator will see for the caller right now: the values the ' +
        'context providers emit, the same ids resolved for display, and the ' +
        'vocabulary a rule can reference.',
    security: [{ session_cookie: [] }],
    response: {
        200: Type.Object({
            values: TypeJsonObject(),
            display: Type.Object({
                connections: Type.Array(
                    Type.Object({
                        id: Type.String(),
                        username: Type.String(),
                    }),
                ),
                groups: Type.Array(
                    Type.Object({ id: Type.String(), name: Type.String() }),
                ),
            }),
            names: Type.Array(
                Type.Object({
                    key: Type.String(),
                    providedBy: Type.String(),
                    description: Type.String(),
                    example: Type.String(),
                }),
            ),
        }),
        // Not a validation error: `mergeContributions` throws on a provider
        // key collision, and the global handler turns that into a plain 400.
        400: GeneralErrorResponse,
        401: NotAuthenticatedErrorResponse,
    },
} as const;

export const MePostRuleCoverageSchema = {
    tags: ['me'],
    summary: 'Count which of my resources each rule pattern covers',
    description:
        'Patterns arrive already parsed from the client -- the backend has no ' +
        '.bart parser, and adding one would mean a second parser to keep in ' +
        'sync. The server contributes the part the client cannot have: the ' +
        "caller's complete resource set, so the denominator is exact rather " +
        'than one page. Each entry also reports the covered count and a ' +
        'sample of covered resource names. When a pattern covers nothing, ' +
        '`nearest` names the resource it came closest to and the attributes ' +
        'that stood in the way.',
    security: [{ session_cookie: [] }],
    body: Type.Object({
        patterns: Type.Array(TypeJsonObject(), { maxItems: 200 }),
    }),
    response: {
        200: Type.Object({
            total: Type.Integer(),
            coverage: Type.Array(
                Type.Object({
                    count: Type.Integer(),
                    sample: Type.Array(Type.String()),
                    // Null when the pattern covers something: no gap to
                    // name. Same shape as `resources.schema.ts`'s `evaluation`.
                    nearest: Type.Union([
                        Type.Object({
                            name: Type.String(),
                            missing: Type.Array(Type.String()),
                            conflicting: Type.Array(Type.String()),
                        }),
                        Type.Null(),
                    ]),
                }),
            ),
        }),
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
    },
} as const;

export const MeGetGroupsSchema = {
    tags: ['me'],
    summary: "Get the user's groups",
    description: 'Get the groups the authenticated user is a member of',
    security: [{ session_cookie: [] }],
    querystring: Type.Partial(
        Type.Object({
            page: Type.Integer({ minimum: 1 }),
            name: Type.String(),
        }),
    ),
    response: {
        200: paginatedResults(GroupType),
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const MePostGroupSchema = {
    tags: ['me'],
    summary: 'Join a group',
    description: 'Add the authenticated user to a group',
    security: [{ session_cookie: [] }],
    params: Type.Object({ groupId: Type.String({ format: 'uuid' }) }),
    response: {
        204: NoContentResponse,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
        409: ConflictErrorResponse,
    },
} as const;

export const MeDeleteGroupSchema = {
    tags: ['me'],
    summary: 'Leave a group',
    description: 'Remove the authenticated user from a group',
    security: [{ session_cookie: [] }],
    params: Type.Object({ groupId: Type.String({ format: 'uuid' }) }),
    response: {
        204: NoContentResponse,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;
