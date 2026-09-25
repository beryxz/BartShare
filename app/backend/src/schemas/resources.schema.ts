import { Type } from '@fastify/type-provider-typebox';
import {
    InternalServerErrorResponse,
    NotAuthenticatedErrorResponse,
    NotAuthorizedErrorResponse,
    NotFoundErrorResponse,
    paginatedResults,
    PayloadTooLargeErrorResponse,
    ServiceUnavailableErrorResponse,
    TypeJsonObject,
    ValidationErrorResponse,
} from '../utils/schemas.utils';
import { Nullable } from '../utils/typebox.utils';

export const ResourceContentType = Nullable(
    Type.Object({
        type: Type.String(),
        size: Type.Integer(),
        filename: Nullable(Type.String()),
    }),
);

export const ResourceType = Type.Object({
    id: Type.String(),
    attrs: TypeJsonObject(),
    metadata: TypeJsonObject(),
    content: ResourceContentType,
});

export const ResourceWithUserType = Type.Object({
    id: Type.String(),
    attrs: TypeJsonObject(),
    metadata: TypeJsonObject(),
    content: ResourceContentType,
    user: Type.Object({ id: Type.String() }),
});

export const ResourcesGetAllSchema = {
    tags: ['resources'],
    summary: 'Get resources',
    description: 'Get all resources',
    security: [],
    querystring: Type.Partial(
        Type.Object({
            page: Type.Integer({ minimum: 1 }),
            name: Type.String(),
            attr: Type.String(),
            excludeUserId: Type.String({ format: 'uuid' }),
        }),
    ),
    response: {
        200: paginatedResults(ResourceWithUserType),
        400: ValidationErrorResponse,
    },
} as const;

export const FacetsResponse = Type.Object({
    facets: Type.Array(
        Type.Object({ key: Type.String(), values: Type.Array(Type.String()) }),
    ),
});

export const ResourcesGetFacetsSchema = {
    tags: ['resources'],
    summary: 'Get resource filter facets',
    description:
        'The distinct attribute vocabulary across all resources, honouring ' +
        'the same filters as the list endpoint. Reserved keys are excluded.',
    security: [],
    querystring: Type.Partial(
        Type.Object({
            name: Type.String(),
            attr: Type.String(),
            excludeUserId: Type.String({ format: 'uuid' }),
        }),
    ),
    response: { 200: FacetsResponse, 400: ValidationErrorResponse },
} as const;

export const ResourcesGetOneSchema = {
    tags: ['resources'],
    summary: 'Get resource',
    description: 'Get a single resource',
    security: [],
    params: Type.Object({ resourceId: Type.String({ format: 'uuid' }) }),
    response: {
        200: ResourceWithUserType,
        400: ValidationErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const ResourcesCreateNewSchema = {
    tags: ['resources'],
    summary: 'Create resource',
    description: 'Create a new resource owned by the authenticated user',
    security: [{ session_cookie: [] }],
    body: Type.Object({
        attrs: TypeJsonObject(),
        metadata: TypeJsonObject(),
    }),
    response: {
        201: ResourceWithUserType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
    },
} as const;

export const ResourcesPatchOneSchema = {
    tags: ['resources'],
    summary: 'Modify resource',
    description: 'Modify a resource owned by the authenticated user',
    security: [{ session_cookie: [] }],
    params: Type.Object({ resourceId: Type.String({ format: 'uuid' }) }),
    body: Type.Partial(
        Type.Object({
            attrs: TypeJsonObject(),
            metadata: TypeJsonObject(),
        }),
    ),
    response: {
        200: ResourceWithUserType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const ResourcesDeleteOneSchema = {
    tags: ['resources'],
    summary: 'Delete resource',
    description: 'Delete a resource owned by the authenticated user',
    security: [{ session_cookie: [] }],
    params: Type.Object({ resourceId: Type.String({ format: 'uuid' }) }),
    response: {
        200: ResourceWithUserType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const AccessEvaluationType = Type.Object({
    parties: Type.Array(Type.String()),
    requests: Type.Array(
        Type.Object({
            requester: Type.String(),
            from: Type.String(),
            resource: TypeJsonObject(),
        }),
    ),
    trace: Type.String(),
    scenario: Type.String(),
});

export const ResourcesPutContentSchema = {
    tags: ['resources'],
    summary: 'Upload resource content',
    description:
        'Replaces the resource content with the raw request body. Owner only. ' +
        'The body is sent as application/octet-stream; ?filename= becomes the ' +
        'stored filename and ?contentType= the stored MIME type (defaults to ' +
        'application/octet-stream).',
    security: [{ session_cookie: [] }],
    consumes: ['application/octet-stream'],
    params: Type.Object({ resourceId: Type.String({ format: 'uuid' }) }),
    querystring: Type.Partial(
        Type.Object({
            filename: Type.String({ minLength: 1, maxLength: 255 }),
            contentType: Type.String({
                pattern: '^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$',
                maxLength: 255,
            }),
        }),
    ),
    // No `body`: a Buffer is not describable as a TypeBox schema, and declaring
    // one would make Fastify try to validate the bytes.
    response: {
        200: ResourceWithUserType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
        413: PayloadTooLargeErrorResponse,
    },
} as const;

export const ResourcesGetContentSchema = {
    tags: ['resources'],
    summary: 'Download resource content',
    description:
        'Streams the resource bytes if the caller owns the resource or the ' +
        'evaluator permits access. A denial is a 403: a download is an action, ' +
        'unlike /access which answers a question.',
    security: [{ session_cookie: [] }],
    produces: ['application/octet-stream'],
    params: Type.Object({ resourceId: Type.String({ format: 'uuid' }) }),
    // 200 is deliberately absent: declaring it would hand the Buffer to
    // fast-json-stringify.
    response: {
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
        500: InternalServerErrorResponse,
        503: ServiceUnavailableErrorResponse,
    },
} as const;

export const ResourcesDeleteContentSchema = {
    tags: ['resources'],
    summary: 'Delete resource content',
    description: 'Clears the content of a resource, keeping the resource.',
    security: [{ session_cookie: [] }],
    params: Type.Object({ resourceId: Type.String({ format: 'uuid' }) }),
    response: {
        200: ResourceWithUserType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const ResourcesCustomAccessSchema = {
    tags: ['resources'],
    summary: 'Evaluate a custom request',
    description:
        'Evaluates a caller-composed request against the whole policy system: ' +
        'any resource pattern, and any any/all party pattern in the from slot. ' +
        'Not tied to a stored resource: a permit is a claim about a resource ' +
        'description, so there is nothing to download.',
    security: [{ session_cookie: [] }],
    body: Type.Object({
        resource: TypeJsonObject(),
        from: Type.Object({
            quantifier: Type.Union([Type.Literal('any'), Type.Literal('all')]),
            attrs: TypeJsonObject(),
        }),
    }),
    response: {
        200: Type.Object({
            permitted: Type.Boolean(),
            evaluation: AccessEvaluationType,
        }),
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        500: InternalServerErrorResponse,
        503: ServiceUnavailableErrorResponse,
    },
} as const;

export const ResourcesAccessOneSchema = {
    tags: ['resources'],
    summary: 'Access resource',
    description:
        'Evaluates whether the authenticated user may access the resource, by assembling ' +
        'a Bart policy system from the party closure and asking the evaluator service.',
    security: [{ session_cookie: [] }],
    params: Type.Object({ resourceId: Type.String({ format: 'uuid' }) }),
    response: {
        200: Type.Object({
            resourceId: Type.String(),
            permitted: Type.Boolean(),
            // null when the caller owns the resource: no evaluation was run.
            evaluation: Type.Union([AccessEvaluationType, Type.Null()]),
        }),
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        404: NotFoundErrorResponse,
        500: InternalServerErrorResponse,
        503: ServiceUnavailableErrorResponse,
    },
} as const;
