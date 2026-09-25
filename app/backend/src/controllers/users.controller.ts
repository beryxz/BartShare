import { FastifyInstance } from 'fastify';
import { OrderItem } from 'sequelize';
import { Static } from 'typebox';
import { mapEvaluatorError } from '../bart/evaluator.client';
import { validateAttrs } from '../bart/reserved';
import { validateUserRules } from '../bart/rules.validation';
import { BartAttrs } from '../bart/types';
import { APP_LIMITS } from '../config';
import { User } from '../models/models';
import {
    UsersCreateNewSchema,
    UsersGetAllSchema,
    UsersGetFacetsSchema,
    UsersGetOneSchema,
    UserType,
} from '../schemas/users.schema';
import {
    returnPaginatedResults,
    whereJsonSubstring,
} from '../utils/controllers.utils';
import { logEvent } from '../utils/events.utils';
import { facetsOfUsers } from '../utils/facets.utils';
import { log } from '../utils/general.utils';
import {
    FastifyReplyTypebox,
    FastifyRequestTypebox,
} from '../utils/typebox.utils';
import {
    isUsernameTaken,
    MSG_USERNAME_TAKEN,
    normalizeAttrsUsername,
} from '../utils/users.utils';

async function get_all(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof UsersGetAllSchema>,
    reply: FastifyReplyTypebox<typeof UsersGetAllSchema>,
) {
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.users.pageSize;
    const order: OrderItem[] = [
        ['createdAt', 'DESC'],
        ['id', 'ASC'],
    ];

    const { count, rows } = await User.findAndCountAll({
        distinct: true,
        limit: pageSize,
        offset: pageSize * (pageNum - 1),
        where: whereJsonSubstring(
            this,
            'attrs.username',
            request.query.username,
        ),
        attributes: ['id', 'attrs', 'rules'],
        order,
    });

    const users = rows.map(user => ({
        id: user.id,
        attrs: user.attrs,
        rules: user.rules,
    }));
    return reply.status(200).send(
        returnPaginatedResults<Static<typeof UserType>>(users, count, {
            size: pageSize,
            number: pageNum,
        }),
    );
}

async function get_facets(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof UsersGetFacetsSchema>,
    reply: FastifyReplyTypebox<typeof UsersGetFacetsSchema>,
) {
    const facets = await facetsOfUsers(this, {
        username: request.query.username,
    });
    return reply.status(200).send({ facets });
}

async function get_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof UsersGetOneSchema>,
    reply: FastifyReplyTypebox<typeof UsersGetOneSchema>,
) {
    const user = await User.findByPk(request.params.userId, {
        attributes: ['id', 'attrs', 'rules'],
    });
    if (user === null) return reply.status(404).send();
    return reply
        .status(200)
        .send({ id: user.id, attrs: user.attrs, rules: user.rules });
}

async function create_new(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof UsersCreateNewSchema>,
    reply: FastifyReplyTypebox<typeof UsersCreateNewSchema>,
) {
    const attrErrors = validateAttrs(request.body.attrs);
    if (attrErrors.length > 0)
        return reply.status(400).send({ errors: attrErrors });

    // Normalise before the uniqueness check and the write, so both see the
    // same trimmed value (see normalizeAttrsUsername).
    const attrs = normalizeAttrsUsername(request.body.attrs);

    const username = attrs.username;
    if (typeof username === 'string' && (await isUsernameTaken(username)))
        return reply.status(400).send({ errors: [MSG_USERNAME_TAKEN] });

    const rules = request.body.rules ?? [];
    // User.create hasn't run, so there is no real id yet; only its presence
    // matters for the parse, so this placeholder is deliberate.
    let ruleErrors: string[];
    try {
        ruleErrors = await validateUserRules({
            id: '00000000-0000-0000-0000-000000000000',
            attrs: attrs as BartAttrs,
            rules,
        });
    } catch (error) {
        // Public route: an evaluator outage must not surface as a 400 or leak
        // EVALUATOR_URL via error.message (see mapEvaluatorError).
        const mapped = mapEvaluatorError(error);
        if (mapped === null) throw error;
        log(`[users.create_new] ${(error as Error).message}`);
        return reply.status(mapped.status).send({ errors: mapped.errors });
    }
    if (ruleErrors.length > 0)
        return reply.status(400).send({ errors: ruleErrors });

    const newUser = await User.create({
        attrs,
        rules,
    });
    await logEvent('user.create', newUser.id);
    return reply.status(201).send({
        id: newUser.id,
        attrs: newUser.attrs,
        rules: newUser.rules,
    });
}

export default { get_all, get_facets, get_one, create_new };
