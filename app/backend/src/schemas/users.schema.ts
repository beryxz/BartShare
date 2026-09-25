import { Type } from '@fastify/type-provider-typebox';
import { FacetsResponse } from './resources.schema';
import {
    InternalServerErrorResponse,
    NotFoundErrorResponse,
    paginatedResults,
    ServiceUnavailableErrorResponse,
    TypeJsonObject,
    ValidationErrorResponse,
} from '../utils/schemas.utils';

export const UserType = Type.Object({
    id: Type.String(),
    attrs: TypeJsonObject(),
    rules: Type.Array(Type.String()),
});

export const UsersGetAllSchema = {
    tags: ['users'],
    summary: 'Get users',
    description: 'Get all users',
    security: [],
    querystring: Type.Partial(
        Type.Object({
            page: Type.Integer({ minimum: 1 }),
            username: Type.String(),
        }),
    ),
    response: {
        200: paginatedResults(UserType),
        400: ValidationErrorResponse,
    },
} as const;

export const UsersGetFacetsSchema = {
    tags: ['users'],
    summary: 'Get party attribute facets',
    description:
        'The distinct attribute vocabulary across all parties. Reserved ' +
        'keys are excluded, `userId` among them.',
    security: [],
    querystring: Type.Partial(Type.Object({ username: Type.String() })),
    response: { 200: FacetsResponse, 400: ValidationErrorResponse },
} as const;

export const UsersGetOneSchema = {
    tags: ['users'],
    summary: 'Get user',
    description: 'Get a single user',
    security: [],
    params: Type.Object({ userId: Type.String({ format: 'uuid' }) }),
    response: {
        200: UserType,
        400: ValidationErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const UsersCreateNewSchema = {
    tags: ['users'],
    summary: 'Create user',
    description: 'Create a new user',
    security: [],
    body: Type.Object({
        attrs: TypeJsonObject(),
        rules: Type.Optional(Type.Array(Type.String())),
    }),
    response: {
        201: UserType,
        400: ValidationErrorResponse,
        500: InternalServerErrorResponse,
        503: ServiceUnavailableErrorResponse,
    },
} as const;
