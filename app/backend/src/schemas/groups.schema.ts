import { Type } from '@fastify/type-provider-typebox';
import {
    NotAuthenticatedErrorResponse,
    NotAuthorizedErrorResponse,
    NotFoundErrorResponse,
    paginatedResults,
    ValidationErrorResponse,
} from '../utils/schemas.utils';

export const GroupType = Type.Object({
    id: Type.String(),
    name: Type.String(),
    description: Type.String(),
});

export const GroupsGetAllSchema = {
    tags: ['groups'],
    summary: 'Get groups',
    description: 'Get all groups',
    security: [],
    querystring: Type.Partial(
        Type.Object({
            page: Type.Integer({ minimum: 1 }),
            name: Type.String(),
        }),
    ),
    response: {
        200: paginatedResults(GroupType),
        400: ValidationErrorResponse,
    },
} as const;

export const GroupsGetOneSchema = {
    tags: ['groups'],
    summary: 'Get group',
    description: 'Get a single group',
    security: [],
    params: Type.Object({ groupId: Type.String({ format: 'uuid' }) }),
    response: {
        200: GroupType,
        400: ValidationErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const GroupsCreateNewSchema = {
    tags: ['groups'],
    summary: 'Create group',
    description: 'Create a new group; the authenticated user joins it',
    security: [{ session_cookie: [] }],
    body: Type.Object({
        name: Type.String(),
        description: Type.String(),
    }),
    response: {
        201: GroupType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
    },
} as const;

export const GroupsPatchOneSchema = {
    tags: ['groups'],
    summary: 'Modify group',
    description: 'Modify a group the authenticated user is a member of',
    security: [{ session_cookie: [] }],
    params: Type.Object({ groupId: Type.String({ format: 'uuid' }) }),
    body: Type.Partial(
        Type.Object({
            name: Type.String(),
            description: Type.String(),
        }),
    ),
    response: {
        200: GroupType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;

export const GroupsDeleteOneSchema = {
    tags: ['groups'],
    summary: 'Delete group',
    description: 'Delete a group the authenticated user is a member of',
    security: [{ session_cookie: [] }],
    params: Type.Object({ groupId: Type.String({ format: 'uuid' }) }),
    response: {
        200: GroupType,
        400: ValidationErrorResponse,
        401: NotAuthenticatedErrorResponse,
        403: NotAuthorizedErrorResponse,
        404: NotFoundErrorResponse,
    },
} as const;
