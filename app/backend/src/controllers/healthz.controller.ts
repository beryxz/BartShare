import { FastifyInstance } from 'fastify';
import { HealthGetSchema } from '../schemas/healthz.schema';
import {
    FastifyReplyTypebox,
    FastifyRequestTypebox,
} from '../utils/typebox.utils';

async function get_health(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof HealthGetSchema>,
    reply: FastifyReplyTypebox<typeof HealthGetSchema>,
) {
    return reply.status(200).send({ status: 'UP' as const });
}

export default { get_health };
