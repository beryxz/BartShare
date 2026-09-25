import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { User } from '../models/models';
import { FastifyTypebox } from './typebox.utils';

/** 403 body: authenticated but not the owner or group member being mutated. */
const MSG_NOT_AUTHORIZED = 'Not authorized';

const _cookieAuthPlugin: FastifyPluginAsyncTypebox = async (
    fastify: FastifyTypebox,
    opts: FastifyPluginOptions,
) => {
    fastify.decorateRequest('user');

    fastify.addHook('onRequest', async (request, reply) => {
        if (typeof request.cookies?.user !== 'string') {
            reply.status(401);
            throw new Error('Missing authorization cookie');
        }

        try {
            const user = await User.findOne({
                where: { id: request.cookies.user },
                attributes: ['id'],
            });
            // assert user exists
            if (user === null) throw new Error();

            request.user = {
                id: user.id,
            };
        } catch {
            reply.status(401);
            throw new Error('Invalid User ID in cookie');
        }
    });
};
const requireCookieAuth = fp(_cookieAuthPlugin);

/**
 * Installs only the cookie check; unknown paths still fall through to the
 * application-wide 404, since hiding their existence bought nothing here.
 */
function requireUserCookie(fastify: FastifyTypebox) {
    fastify.register(requireCookieAuth);
}

export { MSG_NOT_AUTHORIZED, requireUserCookie };
