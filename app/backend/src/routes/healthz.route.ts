import healthController from '../controllers/healthz.controller';
import { HealthGetSchema } from '../schemas/healthz.schema';
import { wrapSchema } from '../utils/schemas.utils';
import { FastifyTypebox } from '../utils/typebox.utils';

//prettier-ignore
async function routeCallback(fastify: FastifyTypebox) {
    fastify.get('/', wrapSchema(HealthGetSchema), healthController.get_health);
}

export default routeCallback;
