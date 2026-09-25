import usersController from '../controllers/users.controller';
import {
    UsersCreateNewSchema,
    UsersGetAllSchema,
    UsersGetFacetsSchema,
    UsersGetOneSchema,
} from '../schemas/users.schema';
import { wrapSchema } from '../utils/schemas.utils';
import { FastifyTypebox } from '../utils/typebox.utils';

//prettier-ignore
async function routeCallback(fastify: FastifyTypebox) {
    fastify.get('/', wrapSchema(UsersGetAllSchema), usersController.get_all);
    // Before '/:userId', or Fastify matches "facets" as a userId and the uuid
    // format check answers 400. Same ordering trap as '/resources/facets'.
    fastify.get('/facets', wrapSchema(UsersGetFacetsSchema), usersController.get_facets);
    fastify.get('/:userId', wrapSchema(UsersGetOneSchema), usersController.get_one);
    fastify.post('/', wrapSchema(UsersCreateNewSchema), usersController.create_new);
}

export default routeCallback;
