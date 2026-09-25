import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastify from 'fastify';
import { Sequelize } from 'sequelize';
import { SWAGGER_OPTIONS } from './config';
import { mainErrorHandler, notFoundErrorHandler } from './error';
import apiV1Route from './routes/api.v1.route';

function setup(dbInstance: Sequelize) {
    const server = fastify({
        trustProxy: true,
    }).withTypeProvider<TypeBoxTypeProvider>();

    // CORS is always on for this demo app
    server.register(cors, {
        origin: true,
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        exposedHeaders: ['Content-Disposition'],
    });
    server.register(fastifyCookie);
    server.register(fastifySwagger, SWAGGER_OPTIONS);

    // Global, mainly for user-uploaded contents
    server.addHook('onSend', async (_request, reply) => {
        reply.header('X-Content-Type-Options', 'nosniff');
    });

    server.register(apiV1Route, { prefix: '/api/v1' });

    server.setErrorHandler(mainErrorHandler);
    server.setNotFoundHandler(notFoundErrorHandler);

    server.decorate('db', dbInstance);

    return server;
}

export default setup;
