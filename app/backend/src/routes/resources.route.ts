import { APP_LIMITS } from '../config';
import resourcesController from '../controllers/resources.controller';
import {
    ResourcesAccessOneSchema,
    ResourcesCreateNewSchema,
    ResourcesCustomAccessSchema,
    ResourcesDeleteContentSchema,
    ResourcesDeleteOneSchema,
    ResourcesGetAllSchema,
    ResourcesGetContentSchema,
    ResourcesGetFacetsSchema,
    ResourcesGetOneSchema,
    ResourcesPatchOneSchema,
    ResourcesPutContentSchema,
} from '../schemas/resources.schema';
import { requireUserCookie } from '../utils/auth.utils';
import { wrapSchema } from '../utils/schemas.utils';
import { FastifyTypebox } from '../utils/typebox.utils';

//prettier-ignore
async function routeCallback(fastify: FastifyTypebox) {
    fastify.get('/', wrapSchema(ResourcesGetAllSchema), resourcesController.get_all);
    // Must be registered before /:resourceId, or Fastify matches "facets" as a resourceId.
    fastify.get('/facets', wrapSchema(ResourcesGetFacetsSchema), resourcesController.get_facets);
    fastify.get('/:resourceId', wrapSchema(ResourcesGetOneSchema), resourcesController.get_one);

    fastify.register(routeAuthCallback);
}

//prettier-ignore
async function routeAuthCallback(fastify: FastifyTypebox) {
    requireUserCookie(fastify);

    fastify.post('/', wrapSchema(ResourcesCreateNewSchema), resourcesController.create_new);
    fastify.post('/access', wrapSchema(ResourcesCustomAccessSchema), resourcesController.custom_access);
    fastify.patch('/:resourceId', wrapSchema(ResourcesPatchOneSchema), resourcesController.patch_one);
    fastify.delete('/:resourceId', wrapSchema(ResourcesDeleteOneSchema), resourcesController.delete_one);
    fastify.get('/:resourceId/access', wrapSchema(ResourcesAccessOneSchema), resourcesController.access_one);

    // Encapsulated to this plugin, so JSON parsing elsewhere is untouched.
    fastify.addContentTypeParser(
        'application/octet-stream',
        { parseAs: 'buffer' },
        (_request, body, done) => done(null, body),
    );

    fastify.put('/:resourceId/content', {
        ...wrapSchema(ResourcesPutContentSchema),
        // Default is 1MB, far below a 32MB upload. The resulting 413
        // (FST_ERR_CTP_BODY_TOO_LARGE) is forwarded by errorStatusCode().
        bodyLimit: APP_LIMITS.resources.maxContentBytes,
    }, resourcesController.put_content);
    fastify.get('/:resourceId/content', wrapSchema(ResourcesGetContentSchema), resourcesController.get_content);
    fastify.delete('/:resourceId/content', wrapSchema(ResourcesDeleteContentSchema), resourcesController.delete_content);
}

export default routeCallback;
