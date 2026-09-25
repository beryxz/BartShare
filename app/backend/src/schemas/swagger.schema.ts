import { Type } from 'typebox';

export const SwaggerRawSchema = {
    tags: ['swagger'],
    summary: 'Get raw OAS',
    description: 'Get the OpenAPI raw document',
    security: [],
    response: {
        200: {
            content: {
                'application/yaml': {
                    schema: Type.String(),
                },
            },
        },
    },
} as const;

export const SwaggerUiSchema = {
    tags: ['swagger'],
    summary: 'Show OAS UI',
    description: 'Show the OpenAPI document with Redocly UI',
    security: [],
    response: {
        200: {
            content: {
                'text/html': {
                    schema: Type.String(),
                },
            },
        },
    },
} as const;
