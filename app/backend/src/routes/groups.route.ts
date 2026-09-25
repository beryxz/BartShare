import groupsController from '../controllers/groups.controller';
import {
    GroupsCreateNewSchema,
    GroupsDeleteOneSchema,
    GroupsGetAllSchema,
    GroupsGetOneSchema,
    GroupsPatchOneSchema,
} from '../schemas/groups.schema';
import { requireUserCookie } from '../utils/auth.utils';
import { wrapSchema } from '../utils/schemas.utils';
import { FastifyTypebox } from '../utils/typebox.utils';

//prettier-ignore
async function routeCallback(fastify: FastifyTypebox) {
    fastify.get('/', wrapSchema(GroupsGetAllSchema), groupsController.get_all);
    fastify.get('/:groupId', wrapSchema(GroupsGetOneSchema), groupsController.get_one);

    fastify.register(routeAuthCallback);
}

//prettier-ignore
async function routeAuthCallback(fastify: FastifyTypebox) {
    requireUserCookie(fastify);

    fastify.post('/', wrapSchema(GroupsCreateNewSchema), groupsController.create_new);
    fastify.patch('/:groupId', wrapSchema(GroupsPatchOneSchema), groupsController.patch_one);
    fastify.delete('/:groupId', wrapSchema(GroupsDeleteOneSchema), groupsController.delete_one);
}

export default routeCallback;
