import { Type } from 'typebox';

export const HealthGetSchema = {
    summary: 'Liveness probe',
    description: 'Reports that the API is up.',
    security: [],
    response: {
        200: Type.Object({
            status: Type.Literal('UP'),
        }),
    },
} as const;
