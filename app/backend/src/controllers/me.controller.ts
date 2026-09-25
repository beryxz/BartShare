import { FastifyInstance } from 'fastify';
import { OrderItem } from 'sequelize';
import { Static } from 'typebox';
import { buildContextReport } from '../bart/context/report';
import { CoverageResource, nearestGap } from '../bart/coverage';
import { mapEvaluatorError } from '../bart/evaluator.client';
import { matches } from '../bart/matcher';
import { validateAttrs } from '../bart/reserved';
import { validateUserRules } from '../bart/rules.validation';
import { decideSharedWith } from '../bart/shared.service';
import { BartAttrs } from '../bart/types';
import { APP_LIMITS } from '../config';
import { Group, Resource, User } from '../models/models';
import { GroupType } from '../schemas/groups.schema';
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
import { ResourceWithUserType } from '../schemas/resources.schema';
import { UserType } from '../schemas/users.schema';
import {
    returnPaginatedResults,
    whereAttrContains,
    whereJsonSubstring,
    whereSubstring,
} from '../utils/controllers.utils';
import { logEvent } from '../utils/events.utils';
import { facetsOfResources } from '../utils/facets.utils';
import { log } from '../utils/general.utils';
import {
    RESOURCE_VIEW_ATTRIBUTES,
    resourceViewWithUser,
} from '../utils/resources.utils';
import {
    FastifyReplyTypebox,
    FastifyRequestTypebox,
} from '../utils/typebox.utils';
import {
    isUsernameTaken,
    MSG_USERNAME_TAKEN,
    normalizeAttrsUsername,
} from '../utils/users.utils';

async function get_me(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeGetSchema>,
    reply: FastifyReplyTypebox<typeof MeGetSchema>,
) {
    const user = await User.findByPk(request.user.id, {
        attributes: ['id', 'attrs', 'rules'],
    });
    if (user === null) return reply.status(404).send();
    return reply
        .status(200)
        .send({ id: user.id, attrs: user.attrs, rules: user.rules });
}

async function patch_me(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MePatchSchema>,
    reply: FastifyReplyTypebox<typeof MePatchSchema>,
) {
    const user = await User.findByPk(request.user.id);
    if (user === null) return reply.status(404).send();

    // Normalised in place, so the uniqueness check, the rules validation, and
    // the write all see the same trimmed value (see normalizeAttrsUsername).
    let attrs = request.body.attrs;
    if (attrs !== undefined) {
        const attrErrors = validateAttrs(attrs);
        if (attrErrors.length > 0)
            return reply.status(400).send({ errors: attrErrors });

        attrs = normalizeAttrsUsername(attrs);

        const username = attrs.username;
        if (
            typeof username === 'string' &&
            (await isUsernameTaken(username, user.id))
        )
            return reply.status(400).send({ errors: [MSG_USERNAME_TAKEN] });
    }

    // Validated against the post-patch state, not the stored one: an
    // attrs-only change can still invalidate a rule, so it revalidates too.
    if (request.body.rules !== undefined || attrs !== undefined) {
        const nextAttrs = (attrs ?? user.attrs) as BartAttrs;
        let ruleErrors: string[];
        try {
            ruleErrors = await validateUserRules({
                id: user.id,
                attrs: nextAttrs,
                rules: request.body.rules ?? user.rules,
            });
        } catch (error) {
            const mapped = mapEvaluatorError(error);
            if (mapped === null) throw error;
            log(`[me.patch_me] ${(error as Error).message}`);
            return reply.status(mapped.status).send({ errors: mapped.errors });
        }
        if (ruleErrors.length > 0)
            return reply.status(400).send({ errors: ruleErrors });
    }

    if (attrs !== undefined) user.set({ attrs });
    if (request.body.rules !== undefined)
        user.set({ rules: request.body.rules });

    await user.save();
    return reply
        .status(200)
        .send({ id: user.id, attrs: user.attrs, rules: user.rules });
}

async function delete_me(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeDeleteSchema>,
    reply: FastifyReplyTypebox<typeof MeDeleteSchema>,
) {
    const user = await User.findByPk(request.user.id);
    if (user === null) return reply.status(404).send();

    const payload = { id: user.id, attrs: user.attrs, rules: user.rules };

    await this.db.transaction(async transaction => {
        await Resource.destroy({
            where: { UserId: user.id },
            transaction,
        });

        // connections are stored as two mirrored rows; setConnections([]) only
        // clears the ones where this user is the source, so drop the mirrors first
        const connections = await user.getConnections({ transaction });
        for (const other of connections) {
            await other.removeConnection(user, { transaction });
        }
        await user.setConnections([], { transaction });

        await user.setGroups([], { transaction });
        await user.destroy({ force: true, transaction });
    });

    // logged with a null user: the row would otherwise reference a deleted user
    await logEvent('user.delete', null, { userId: payload.id });
    return reply.status(200).send(payload);
}

const MSG_SELF_CONNECTION = 'Cannot connect a user to itself';

async function get_context(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeGetContextSchema>,
    reply: FastifyReplyTypebox<typeof MeGetContextSchema>,
) {
    return reply.status(200).send(await buildContextReport(request.user.id));
}

async function get_resources(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeGetResourcesSchema>,
    reply: FastifyReplyTypebox<typeof MeGetResourcesSchema>,
) {
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.resources.pageSize;
    const order: OrderItem[] = [
        ['createdAt', 'DESC'],
        ['id', 'ASC'],
    ];

    const { count, rows } = await Resource.findAndCountAll({
        distinct: true,
        limit: pageSize,
        offset: pageSize * (pageNum - 1),
        where: {
            UserId: request.user.id,
            ...whereJsonSubstring(this, 'metadata.name', request.query.name),
            ...whereAttrContains('attrs', request.query.attr),
        },
        attributes: [...RESOURCE_VIEW_ATTRIBUTES],
        order,
    });

    const resources = rows.map(resource =>
        resourceViewWithUser(resource, request.user.id),
    );
    return reply
        .status(200)
        .send(
            returnPaginatedResults<Static<typeof ResourceWithUserType>>(
                resources,
                count,
                { size: pageSize, number: pageNum },
            ),
        );
}

async function get_resource_facets(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeGetResourceFacetsSchema>,
    reply: FastifyReplyTypebox<typeof MeGetResourceFacetsSchema>,
) {
    const facets = await facetsOfResources(this, {
        name: request.query.name,
        attr: request.query.attr,
        ownerId: request.user.id,
    });
    return reply.status(200).send({ facets });
}

async function get_shared(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeGetSharedSchema>,
    reply: FastifyReplyTypebox<typeof MeGetSharedSchema>,
) {
    let scan;
    try {
        scan = await decideSharedWith(
            request.user.id,
            { name: request.query.name, attr: request.query.attr },
            this,
        );
    } catch (error) {
        const mapped = mapEvaluatorError(error);
        if (mapped === null) throw error;
        log(`[me.get_shared] ${(error as Error).message}`);
        return reply.status(mapped.status).send({ errors: mapped.errors });
    }

    // "Permitted" cannot be pushed into a SQL LIMIT, so the whole candidate set
    // is evaluated and the survivors are paginated here.
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.resources.pageSize;
    const page = scan.resources.slice(
        pageSize * (pageNum - 1),
        pageSize * pageNum,
    );

    return reply.status(200).send({
        ...returnPaginatedResults<Static<typeof ResourceWithUserType>>(
            page.map(resource =>
                resourceViewWithUser(resource, resource.UserId),
            ),
            scan.resources.length,
            { size: pageSize, number: pageNum },
        ),
        scan: {
            considered: scan.considered,
            total: scan.total,
            truncated: scan.truncated,
        },
    });
}

async function get_connections(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeGetConnectionsSchema>,
    reply: FastifyReplyTypebox<typeof MeGetConnectionsSchema>,
) {
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.users.pageSize;

    const user = await User.findByPk(request.user.id);
    if (user === null) return reply.status(404).send();

    const where = whereJsonSubstring(
        this,
        'attrs.username',
        request.query.username,
    );
    const count = await user.countConnections({ where });
    const rows = await user.getConnections({
        where,
        limit: pageSize,
        offset: pageSize * (pageNum - 1),
        attributes: ['id', 'attrs', 'rules'],
        order: [['id', 'ASC']],
    });

    const connections = rows.map(connection => ({
        id: connection.id,
        attrs: connection.attrs,
        rules: connection.rules,
    }));
    return reply
        .status(200)
        .send(
            returnPaginatedResults<Static<typeof UserType>>(
                connections,
                count,
                { size: pageSize, number: pageNum },
            ),
        );
}

async function post_connection(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MePostConnectionSchema>,
    reply: FastifyReplyTypebox<typeof MePostConnectionSchema>,
) {
    if (request.params.userId === request.user.id)
        return reply.status(400).send({ errors: [MSG_SELF_CONNECTION] });

    const [user, other] = await Promise.all([
        User.findByPk(request.user.id),
        User.findByPk(request.params.userId),
    ]);
    if (user === null || other === null) return reply.status(404).send();
    if (await user.hasConnection(other)) return reply.status(409).send();

    await this.db.transaction(async transaction => {
        await user.addConnection(other, { transaction });
        await other.addConnection(user, { transaction });
    });

    await logEvent('connection.create', user.id, { userId: other.id });
    return reply.status(204).send();
}

async function delete_connection(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeDeleteConnectionSchema>,
    reply: FastifyReplyTypebox<typeof MeDeleteConnectionSchema>,
) {
    const [user, other] = await Promise.all([
        User.findByPk(request.user.id),
        User.findByPk(request.params.userId),
    ]);
    if (user === null || other === null) return reply.status(404).send();
    if (!(await user.hasConnection(other))) return reply.status(404).send();

    await this.db.transaction(async transaction => {
        await user.removeConnection(other, { transaction });
        await other.removeConnection(user, { transaction });
    });

    await logEvent('connection.delete', user.id, { userId: other.id });
    return reply.status(204).send();
}

async function get_groups(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeGetGroupsSchema>,
    reply: FastifyReplyTypebox<typeof MeGetGroupsSchema>,
) {
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.groups.pageSize;

    const user = await User.findByPk(request.user.id);
    if (user === null) return reply.status(404).send();

    const where = whereSubstring<Group>(this, 'name', request.query.name);
    const count = await user.countGroups({ where });
    const rows = await user.getGroups({
        where,
        limit: pageSize,
        offset: pageSize * (pageNum - 1),
        attributes: ['id', 'name', 'description'],
        // Tiebreaker: two groups may share a name, and without one offset
        // paging can repeat or skip a row between pages.
        order: [
            ['name', 'ASC'],
            ['id', 'ASC'],
        ],
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

async function post_group(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MePostGroupSchema>,
    reply: FastifyReplyTypebox<typeof MePostGroupSchema>,
) {
    const [user, group] = await Promise.all([
        User.findByPk(request.user.id),
        Group.findByPk(request.params.groupId),
    ]);
    if (user === null || group === null) return reply.status(404).send();
    if (await user.hasGroup(group)) return reply.status(409).send();

    await user.addGroup(group);
    await logEvent('group.join', user.id, { groupId: group.id });
    return reply.status(204).send();
}

async function delete_group(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MeDeleteGroupSchema>,
    reply: FastifyReplyTypebox<typeof MeDeleteGroupSchema>,
) {
    const [user, group] = await Promise.all([
        User.findByPk(request.user.id),
        Group.findByPk(request.params.groupId),
    ]);
    if (user === null || group === null) return reply.status(404).send();
    if (!(await user.hasGroup(group))) return reply.status(404).send();

    await user.removeGroup(group);
    await logEvent('group.leave', user.id, { groupId: group.id });
    return reply.status(204).send();
}

/** How many covered resource names the popover shows before it stops listing. */
const COVERAGE_SAMPLE_LIMIT = 20;

async function post_rule_coverage(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof MePostRuleCoverageSchema>,
    reply: FastifyReplyTypebox<typeof MePostRuleCoverageSchema>,
) {
    const resources = await Resource.findAll({
        where: { UserId: request.user.id },
        attributes: ['id', 'attrs', 'metadata'],
    });

    const rows: CoverageResource[] = resources.map(resource => ({
        id: resource.id,
        name: String(resource.metadata.name ?? ''),
        attrs: resource.attrs as BartAttrs,
    }));

    const coverage = request.body.patterns.map(pattern => {
        // `matches(a, b)`: every key of a appears in b with an equal value.
        // Called resource-first; swapping the args asks a different question.
        const covered = rows.filter(row =>
            matches(row.attrs, pattern as BartAttrs),
        );
        return {
            count: covered.length,
            sample: covered
                .slice(0, COVERAGE_SAMPLE_LIMIT)
                .map(row => row.name),
            // Only an empty match needs an explanation; one that covers
            // something has already answered the question.
            nearest:
                covered.length === 0
                    ? nearestGap(rows, pattern as BartAttrs)
                    : null,
        };
    });

    return reply.status(200).send({ total: rows.length, coverage });
}

export default {
    get_me,
    patch_me,
    delete_me,
    get_context,
    get_resources,
    get_resource_facets,
    get_shared,
    get_connections,
    post_connection,
    delete_connection,
    get_groups,
    post_group,
    delete_group,
    post_rule_coverage,
};
