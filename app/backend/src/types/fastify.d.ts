import { Sequelize } from 'sequelize';

//TODO: `request.user` should be typed only on routes behind requireUserCookie.
//      Now typescript sees it on all routes.
//      Waiting for Fastify v6? -> https://github.com/fastify/fastify/issues/5061

declare module 'fastify' {
    interface FastifyInstance {
        db: Sequelize;
    }

    interface FastifyRequest {
        user: {
            id: string;
        };
    }
}
