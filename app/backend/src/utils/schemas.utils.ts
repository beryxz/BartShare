import { FastifySchema } from 'fastify';
import { TSchema, TSchemaOptions, Type } from 'typebox';

export const TypeVoid = (opts?: TSchemaOptions) =>
    Type.Unsafe<void>({ type: 'null', ...opts });

/**
 * A free-form JSON object (e.g. `User.attrs`, `Resource.attrs`).
 * `additionalProperties` is required: without it, fast-json-stringify
 * strips every key on the way out.
 */
export const TypeJsonObject = (opts?: TSchemaOptions) =>
    Type.Unsafe<Record<string, unknown>>({
        type: 'object',
        additionalProperties: true,
        ...opts,
    });

export const NoContentResponse = TypeVoid({
    description: 'No content response',
});

/** 400: for any reason other than validation */
export const GeneralErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'General error' },
);

/** 400: raised by schema or model validation */
export const ValidationErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'Validation error' },
);

/** 401: error */
export const NotAuthenticatedErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'Not authenticated error' },
);

/** 403: error */
export const NotAuthorizedErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'Not authorized error' },
);

/** 404: always empty-bodied */
export const NotFoundErrorResponse = TypeVoid({
    description: 'Not found error',
});

/** 409: that only reports the clash, empty-bodied */
export const ConflictErrorResponse = TypeVoid({
    description: 'Resource conflict error',
});

/** 409: that names what clashed */
export const ConflictReasonErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'Resource conflict error, with a reason' },
);

/** 413: raised by the body-size limit */
export const PayloadTooLargeErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'Payload too large error' },
);

/** 500: error */
export const InternalServerErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'Internal server error' },
);

/** 503: error */
export const ServiceUnavailableErrorResponse = Type.Object(
    {
        errors: Type.Array(Type.String()),
    },
    { description: 'Service unavailable error' },
);

export type PaginatedResults<Item> = {
    data: Item[];
    page: {
        size: number;
        totalElements: number;
        totalPages: number;
        number: number;
    };
};
export function paginatedResults(itemsSchema: TSchema) {
    return Type.Object({
        data: Type.Array(itemsSchema),
        page: Type.Object({
            size: Type.Number(),
            totalElements: Type.Number(),
            totalPages: Type.Number(),
            number: Type.Number(),
        }),
    });
}

export const wrapSchema = <TSchema extends FastifySchema>(
    schemaObject: TSchema,
) => ({
    schema: schemaObject,
});
