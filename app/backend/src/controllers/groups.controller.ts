import { FastifyInstance } from 'fastify';
import { OrderItem } from 'sequelize';
import { Static } from 'typebox';
import { APP_LIMITS } from '../config';
import { Group, User } from '../models/models';
import {
    GroupsCreateNewSchema,
    GroupsDeleteOneSchema,
    GroupsGetAllSchema,
    GroupsGetOneSchema,
    GroupsPatchOneSchema,
    GroupType,
} from '../schemas/groups.schema';
import { MSG_NOT_AUTHORIZED } from '../utils/auth.utils';
import {
    orderWithFilter,
    returnPaginatedResults,
    whereSubstring,
} from '../utils/controllers.utils';
import { logEvent } from '../utils/events.utils';
import {
    FastifyReplyTypebox,
    FastifyRequestTypebox,
} from '../utils/typebox.utils';

type MembershipResult =
    | { outcome: 'ok'; group: Group }
    | { outcome: 'missing' }
    | { outcome: 'forbidden' };

/**
 * Resolve a group the caller is allowed to mutate: 'missing' when the group
 * does not exist, 'forbidden' when the caller is not one of its members.
 */
async function resolveMembership(
    groupId: string,
    userId: string,
): Promise<MembershipResult> {
    const group = await Group.findByPk(groupId);
    if (group === null) return { outcome: 'missing' };

    const user = await User.findByPk(userId);
    if (user === null || !(await user.hasGroup(group)))
        return { outcome: 'forbidden' };

    return { outcome: 'ok', group };
}

async function get_all(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof GroupsGetAllSchema>,
    reply: FastifyReplyTypebox<typeof GroupsGetAllSchema>,
) {
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.groups.pageSize;
    const order: OrderItem[] = orderWithFilter([
        request.query.name
            ? [
                  this.db.fn(
                      'starts_with',
                      this.db.fn('lower', this.db.col('name')),
                      this.db.fn('lower', request.query.name),
                  ),
                  'DESC',
              ]
            : undefined,
        ['name', 'ASC'],
        // Tiebreaker: two groups may share a name, and without one offset
        // paging can repeat or skip a row between pages.
        ['id', 'ASC'],
    ]);

    const { count, rows } = await Group.findAndCountAll({
        distinct: true,
        limit: pageSize,
        offset: pageSize * (pageNum - 1),
        where: whereSubstring<Group>(this, 'name', request.query.name),
        attributes: ['id', 'name', 'description'],
        order,
    });

    const groups = rows.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
    }));
    return reply.status(200).send(
        returnPaginatedResults<Static<typeof GroupType>>(groups, count, {
            size: pageSize,
            number: pageNum,
        }),
    );
}

async function get_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof GroupsGetOneSchema>,
    reply: FastifyReplyTypebox<typeof GroupsGetOneSchema>,
) {
    const group = await Group.findByPk(request.params.groupId, {
        attributes: ['id', 'name', 'description'],
    });
    if (group === null) return reply.status(404).send();
    return reply.status(200).send({
        id: group.id,
        name: group.name,
        description: group.description,
    });
}

async function create_new(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof GroupsCreateNewSchema>,
    reply: FastifyReplyTypebox<typeof GroupsCreateNewSchema>,
) {
    const user = await User.findByPk(request.user.id);
    if (user === null)
        return reply.status(403).send({ errors: [MSG_NOT_AUTHORIZED] });

    const newGroup = await this.db.transaction(async transaction => {
        const group = await Group.create(
            {
                name: request.body.name,
                description: request.body.description,
            },
            { transaction },
        );
        await user.addGroup(group, { transaction });
        return group;
    });

    await logEvent('group.create', user.id, { groupId: newGroup.id });
    return reply.status(201).send({
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description,
    });
}

async function patch_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof GroupsPatchOneSchema>,
    reply: FastifyReplyTypebox<typeof GroupsPatchOneSchema>,
) {
    const result = await resolveMembership(
        request.params.groupId,
        request.user.id,
    );
    if (result.outcome === 'missing') return reply.status(404).send();
    if (result.outcome === 'forbidden')
        return reply.status(403).send({ errors: [MSG_NOT_AUTHORIZED] });
    const { group } = result;

    if (request.body.name !== undefined) group.set({ name: request.body.name });
    if (request.body.description !== undefined)
        group.set({ description: request.body.description });

    await group.save();
    return reply.status(200).send({
        id: group.id,
        name: group.name,
        description: group.description,
    });
}

async function delete_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof GroupsDeleteOneSchema>,
    reply: FastifyReplyTypebox<typeof GroupsDeleteOneSchema>,
) {
    const result = await resolveMembership(
        request.params.groupId,
        request.user.id,
    );
    if (result.outcome === 'missing') return reply.status(404).send();
    if (result.outcome === 'forbidden')
        return reply.status(403).send({ errors: [MSG_NOT_AUTHORIZED] });
    const { group } = result;

    const payload = {
        id: group.id,
        name: group.name,
        description: group.description,
    };
    await group.destroy({ force: true });
    await logEvent('group.delete', request.user.id, { groupId: payload.id });
    return reply.status(200).send(payload);
}

export default { get_all, get_one, create_new, patch_one, delete_one };
