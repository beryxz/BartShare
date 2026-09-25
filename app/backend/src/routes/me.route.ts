import meController from '../controllers/me.controller';
import {
    MeDeleteConnectionSchema,
    MeDeleteGroupSchema,
    MeDeleteSchema,
    MeGetConnectionsSchema,
    MeGetContextSchema,
    MeGetGroupsSchema,
    MeGetResourceFacetsSchema,
    MeGetResourcesSchema,
    MeGetSchema,
    MeGetSharedSchema,
    MePatchSchema,
    MePostConnectionSchema,
    MePostGroupSchema,
    MePostRuleCoverageSchema,
} from '../schemas/me.schema';
import { requireUserCookie } from '../utils/auth.utils';
import { wrapSchema } from '../utils/schemas.utils';
import { FastifyTypebox } from '../utils/typebox.utils';

//prettier-ignore
async function routeCallback(fastify: FastifyTypebox) {
    requireUserCookie(fastify);

    fastify.get('/', wrapSchema(MeGetSchema), meController.get_me);
    fastify.patch('/', wrapSchema(MePatchSchema), meController.patch_me);
    fastify.delete('/', wrapSchema(MeDeleteSchema), meController.delete_me);

    fastify.get('/context', wrapSchema(MeGetContextSchema), meController.get_context);

    fastify.get('/resources', wrapSchema(MeGetResourcesSchema), meController.get_resources);
    fastify.get('/resources/facets', wrapSchema(MeGetResourceFacetsSchema), meController.get_resource_facets);
    fastify.get('/shared', wrapSchema(MeGetSharedSchema), meController.get_shared);

    fastify.post('/rules/coverage', wrapSchema(MePostRuleCoverageSchema), meController.post_rule_coverage);

    fastify.get('/connections', wrapSchema(MeGetConnectionsSchema), meController.get_connections);
    fastify.post('/connections/:userId', wrapSchema(MePostConnectionSchema), meController.post_connection);
    fastify.delete('/connections/:userId', wrapSchema(MeDeleteConnectionSchema), meController.delete_connection);

    fastify.get('/groups', wrapSchema(MeGetGroupsSchema), meController.get_groups);
    fastify.post('/groups/:groupId', wrapSchema(MePostGroupSchema), meController.post_group);
    fastify.delete('/groups/:groupId', wrapSchema(MeDeleteGroupSchema), meController.delete_group);
}

export default routeCallback;
