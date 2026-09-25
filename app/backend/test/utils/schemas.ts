'use strict';

import fastifySwagger from '@fastify/swagger';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastify from 'fastify';
import t from 'tap';
import { Type } from 'typebox';
import { Value } from 'typebox/value';
import { SWAGGER_OPTIONS } from '../../src/config';
import {
    GeneralErrorResponse,
    NoContentResponse,
    paginatedResults,
    wrapSchema,
} from '../../src/utils/schemas.utils';

t.test('wrapSchema nests the schema for fastify', async t => {
    t.plan(1);

    const schema = {
        tags: ['swagger'],
        response: { 400: GeneralErrorResponse },
    } as const;

    t.same(wrapSchema(schema), { schema });
});

t.test('NoContentResponse describes an empty reply', async t => {
    t.plan(3);

    const server = fastify().withTypeProvider<TypeBoxTypeProvider>();
    t.teardown(() => server.close());

    // the swagger plugin only sees routes registered once it is loaded
    await server.register(fastifySwagger, SWAGGER_OPTIONS);
    server.get(
        '/nothing',
        wrapSchema({
            tags: ['swagger'],
            summary: 'Reply without a body',
            response: { 204: NoContentResponse },
        }),
        async (request, reply) => reply.status(204).send(),
    );
    await server.ready();

    const response = await server.inject({ method: 'GET', url: '/nothing' });
    t.equal(response.statusCode, 204, 'status code');
    t.equal(response.body, '', 'empty body');

    t.match(
        server.swagger(),
        {
            paths: {
                '/nothing': {
                    get: {
                        responses: {
                            204: { description: 'No content response' },
                        },
                    },
                },
            },
        },
        'the description reaches the OpenAPI document',
    );
});

t.test('paginatedResults builds a validating page schema', async t => {
    t.plan(3);

    const schema = paginatedResults(Type.Object({ id: Type.String() }));

    t.ok(
        Value.Check(schema, {
            data: [{ id: 'an-id' }],
            page: { size: 10, totalElements: 1, totalPages: 1, number: 0 },
        }),
        'accepts a well formed page',
    );
    t.notOk(
        Value.Check(schema, {
            data: [{ id: 1 }],
            page: { size: 10, totalElements: 1, totalPages: 1, number: 0 },
        }),
        'rejects items that do not match',
    );
    t.notOk(
        Value.Check(schema, { data: [] }),
        'rejects a missing page descriptor',
    );
});
