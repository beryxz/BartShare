import { FastifyTypebox } from '../utils/typebox.utils';
import devRoute from './dev.route';
import groupsRoute from './groups.route';
import healthzRoute from './healthz.route';
import meRoute from './me.route';
import resourcesRoute from './resources.route';

import swaggerRoute from './swagger.route';
import usersRoute from './users.route';

async function routeCallback(fastify: FastifyTypebox) {
    // using only application/json helps against CSRF
    fastify.removeContentTypeParser('text/plain');

    fastify.register(swaggerRoute, { prefix: '/swagger' });
    fastify.register(healthzRoute, { prefix: '/healthz' });

    fastify.register(meRoute, { prefix: '/me' });
    fastify.register(usersRoute, { prefix: '/users' });
    fastify.register(resourcesRoute, { prefix: '/resources' });
    fastify.register(groupsRoute, { prefix: '/groups' });
    fastify.register(devRoute, { prefix: '/dev' });
}

export default routeCallback;
