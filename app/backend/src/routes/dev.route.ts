import devController from '../controllers/dev.controller';
import {
    DevGetEventsSchema,
    DevGetScenariosSchema,
    DevGetStatusSchema,
    DevPostResetSchema,
    DevPostSeedSchema,
} from '../schemas/dev.schema';
import { wrapSchema } from '../utils/schemas.utils';
import { FastifyTypebox } from '../utils/typebox.utils';

/**
 * Registered public, with no `requireUserCookie()`: seeding must work when
 * there are zero users, so there is no cookie or identity to attach the call
 * to. This app has no authentication model beyond that cookie, so gating
 * these routes would buy no protection. The destructive one (reset) is
 * guarded by a confirmation in the UI, not by the backend.
 */
//prettier-ignore
async function routeCallback(fastify: FastifyTypebox) {
    fastify.get('/events', wrapSchema(DevGetEventsSchema), devController.get_events);
    fastify.get('/status', wrapSchema(DevGetStatusSchema), devController.get_status);
    fastify.get('/scenarios', wrapSchema(DevGetScenariosSchema), devController.get_scenarios);
    fastify.post('/seed', wrapSchema(DevPostSeedSchema), devController.post_seed);
    fastify.post('/reset', wrapSchema(DevPostResetSchema), devController.post_reset);
}

export default routeCallback;
