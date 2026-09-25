import { FastifyReply, FastifyRequest } from 'fastify';
import { BaseError, ValidationError } from 'sequelize';
import config from './config';
import { formatValidationError } from './utils/general.utils';

function errorStatusCode(error: unknown): undefined | number {
    return typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined;
}

function errorMessage(error: unknown): undefined | string {
    return typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
        ? error.message
        : undefined;
}

const _mainErrorHandler = (
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    if (error instanceof ValidationError) {
        return reply.status(400).send({ errors: formatValidationError(error) });
    }

    // Fall back to a status the handler already set, if any.
    const replyCode =
        reply.statusCode >= 400 && reply.statusCode <= 599
            ? reply.statusCode
            : undefined;

    if (config.DEBUG) {
        return reply.status(errorStatusCode(error) ?? replyCode ?? 400).send({
            errors: [
                errorMessage(error) ?? 'undefined error',
                JSON.stringify(error),
            ],
        });
    }

    // Mask sequelize errors with a generic one.
    if (error instanceof BaseError) {
        return reply
            .status(400)
            .send({ errors: ['Invalid operation requested'] });
    }
    return reply.status(errorStatusCode(error) ?? replyCode ?? 400).send({
        errors: [errorMessage(error) ?? 'undefined error'],
    });
};

const mainErrorHandler = (
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    try {
        return _mainErrorHandler(error, request, reply);
    } catch {
        return reply.status(500).send();
    }
};

const notFoundErrorHandler = (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send();
};

export { mainErrorHandler, notFoundErrorHandler };
