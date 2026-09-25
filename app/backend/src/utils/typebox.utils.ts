import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
    ContextConfigDefault,
    FastifyBaseLogger,
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
    FastifySchema,
    RawReplyDefaultExpression,
    RawRequestDefaultExpression,
    RawServerDefault,
    RouteGenericInterface,
} from 'fastify';
import { TSchema, Type } from 'typebox';

export type FastifyTypebox = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    FastifyBaseLogger,
    TypeBoxTypeProvider
>;

export type FastifyRequestTypebox<TSchema extends FastifySchema> =
    FastifyRequest<
        RouteGenericInterface,
        RawServerDefault,
        RawRequestDefaultExpression,
        TSchema,
        TypeBoxTypeProvider
    >;

export type FastifyReplyTypebox<TSchema extends FastifySchema> = FastifyReply<
    RouteGenericInterface,
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    ContextConfigDefault,
    TSchema,
    TypeBoxTypeProvider
>;

export const Nullable = <T extends TSchema>(schema: T) => {
    return Type.Union([schema, Type.Null()]);
};
