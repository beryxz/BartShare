import { FastifyInstance, FastifyReply } from 'fastify';
import { Op, OrderItem } from 'sequelize';
import { Static } from 'typebox';
import { decideAccess, decideCustomAccess } from '../bart/access.service';
import { BartEmitError } from '../bart/emitter';
import { mapEvaluatorError } from '../bart/evaluator.client';
import { validateAttrs, validatePartyPattern } from '../bart/reserved';
import { BartAttrs } from '../bart/types';
import { APP_LIMITS } from '../config';
import { Resource, User } from '../models/models';
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
    ResourceWithUserType,
} from '../schemas/resources.schema';
import { MSG_NOT_AUTHORIZED } from '../utils/auth.utils';
import {
    returnPaginatedResults,
    whereAttrContains,
    whereJsonSubstring,
} from '../utils/controllers.utils';
import { logEvent } from '../utils/events.utils';
import { facetsOfResources } from '../utils/facets.utils';
import { log } from '../utils/general.utils';
import {
    contentDispositionHeader,
    RESOURCE_VIEW_ATTRIBUTES,
    resourceViewWithUser,
} from '../utils/resources.utils';
import {
    FastifyReplyTypebox,
    FastifyRequestTypebox,
} from '../utils/typebox.utils';

/**
 * The `BartEmitError` arm the access-path handlers below share.
 *
 * A row that fails to emit predates write validation, so it's server-side
 * corruption regardless of caller: always a 500, with the emitter's own
 * message (which names internals) logged rather than sent.
 */
function storedPolicyFailure(tag: string, error: unknown): string[] | null {
    if (!(error instanceof BartEmitError)) return null;
    log(`[${tag}] a stored row could not be emitted: ${error.message}`);
    return ['Invalid stored policy'];
}

async function get_all(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesGetAllSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesGetAllSchema>,
) {
    const pageNum = Math.max(request.query.page ?? 1, 1);
    const pageSize = APP_LIMITS.resources.pageSize;
    const order: OrderItem[] = [
        [this.db.col('Resource.createdAt'), 'DESC'],
        [this.db.col('Resource.id'), 'ASC'],
    ];
    const where = {
        ...whereJsonSubstring(this, 'metadata.name', request.query.name),
        ...whereAttrContains('attrs', request.query.attr),
        ...(request.query.excludeUserId
            ? { UserId: { [Op.ne]: request.query.excludeUserId } }
            : {}),
    };

    const { count, rows } = await Resource.findAndCountAll({
        distinct: true,
        limit: pageSize,
        offset: pageSize * (pageNum - 1),
        where,
        attributes: [...RESOURCE_VIEW_ATTRIBUTES],
        include: [{ model: User, required: true, attributes: ['id'] }],
        order,
    });

    const resources = rows.map(resource =>
        resourceViewWithUser(resource, resource.User!.id),
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

async function get_facets(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesGetFacetsSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesGetFacetsSchema>,
) {
    const facets = await facetsOfResources(this, {
        name: request.query.name,
        attr: request.query.attr,
        excludeUserId: request.query.excludeUserId,
    });
    return reply.status(200).send({ facets });
}

async function get_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesGetOneSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesGetOneSchema>,
) {
    const resource = await Resource.findByPk(request.params.resourceId, {
        attributes: [...RESOURCE_VIEW_ATTRIBUTES],
        include: [{ model: User, required: true, attributes: ['id'] }],
    });
    if (resource === null) return reply.status(404).send();
    return reply
        .status(200)
        .send(resourceViewWithUser(resource, resource.User!.id));
}

async function create_new(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesCreateNewSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesCreateNewSchema>,
) {
    const attrErrors = validateAttrs(request.body.attrs);
    if (attrErrors.length > 0)
        return reply.status(400).send({ errors: attrErrors });

    const newResource = await Resource.create({
        attrs: request.body.attrs,
        metadata: request.body.metadata,
        UserId: request.user.id,
    });
    await logEvent('resource.create', request.user.id, {
        resourceId: newResource.id,
    });
    return reply
        .status(201)
        .send(resourceViewWithUser(newResource, request.user.id));
}

async function patch_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesPatchOneSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesPatchOneSchema>,
) {
    // UserId is needed for the ownership check; the blob is not, and asking
    // for it would pull up to 32MB into memory just to rename a resource.
    const resource = await Resource.findByPk(request.params.resourceId, {
        attributes: [...RESOURCE_VIEW_ATTRIBUTES, 'UserId'],
    });
    if (resource === null) return reply.status(404).send();
    if (resource.UserId !== request.user.id)
        return reply.status(403).send({ errors: [MSG_NOT_AUTHORIZED] });

    if (request.body.attrs === undefined && request.body.metadata === undefined)
        return reply.status(400).send({
            errors: ['at least one of attrs or metadata is required'],
        });

    if (request.body.attrs !== undefined) {
        const attrErrors = validateAttrs(request.body.attrs);
        if (attrErrors.length > 0)
            return reply.status(400).send({ errors: attrErrors });
        resource.set({ attrs: request.body.attrs });
    }
    if (request.body.metadata !== undefined)
        resource.set({ metadata: request.body.metadata });

    await resource.save();
    return reply
        .status(200)
        .send(resourceViewWithUser(resource, resource.UserId));
}

async function delete_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesDeleteOneSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesDeleteOneSchema>,
) {
    const resource = await Resource.findByPk(request.params.resourceId, {
        attributes: [...RESOURCE_VIEW_ATTRIBUTES, 'UserId'],
    });
    if (resource === null) return reply.status(404).send();
    if (resource.UserId !== request.user.id)
        return reply.status(403).send({ errors: [MSG_NOT_AUTHORIZED] });

    const payload = resourceViewWithUser(resource, resource.UserId);
    await resource.destroy({ force: true });
    await logEvent('resource.delete', request.user.id, {
        resourceId: payload.id,
    });
    return reply.status(200).send(payload);
}

async function access_one(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesAccessOneSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesAccessOneSchema>,
) {
    const resource = await Resource.findByPk(request.params.resourceId, {
        attributes: ['id', 'attrs', 'UserId'],
    });
    if (resource === null) return reply.status(404).send();

    let decision;
    try {
        decision = await decideAccess(request.user.id, {
            id: resource.id,
            attrs: resource.attrs as BartAttrs,
            UserId: resource.UserId,
        });
    } catch (error) {
        const mapped = mapEvaluatorError(error);
        if (mapped !== null) {
            // A rejection here means assembly itself produced something
            // invalid; error.detail already names the offending user.
            log(`[access] ${(error as Error).message}`);
            return reply.status(mapped.status).send({ errors: mapped.errors });
        }
        const stored = storedPolicyFailure('access', error);
        if (stored !== null) return reply.status(500).send({ errors: stored });
        throw error;
    }

    await logEvent('resource.access', request.user.id, {
        resourceId: resource.id,
        permitted: decision.permitted,
        parties: decision.evaluation?.parties ?? null,
    });

    return reply.status(200).send({
        resourceId: resource.id,
        permitted: decision.permitted,
        evaluation: decision.evaluation,
    });
}

async function custom_access(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesCustomAccessSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesCustomAccessSchema>,
) {
    const { resource, from } = request.body;

    // `match({}, rule)` matches every rule, so an empty pattern would be a
    // wildcard grabbing the first unconditional one; the grammar rejects it too.
    if (Object.keys(resource).length === 0)
        return reply
            .status(400)
            .send({ errors: ['resource: at least one attribute is required'] });

    const errors = [
        ...validateAttrs(resource),
        ...validatePartyPattern(from.attrs),
    ];
    if (errors.length > 0) return reply.status(400).send({ errors });

    let decision;
    try {
        decision = await decideCustomAccess(request.user.id, {
            resource: resource as BartAttrs,
            from: {
                quantifier: from.quantifier,
                attrs: from.attrs as BartAttrs,
            },
        });
    } catch (error) {
        const mapped = mapEvaluatorError(error);
        if (mapped !== null) {
            log(`[custom-access] ${(error as Error).message}`);
            return reply.status(mapped.status).send({ errors: mapped.errors });
        }
        const stored = storedPolicyFailure('custom-access', error);
        if (stored !== null) return reply.status(500).send({ errors: stored });
        throw error;
    }

    await logEvent('resource.custom_access', request.user.id, {
        permitted: decision.permitted,
        parties: decision.evaluation?.parties ?? null,
    });

    return reply.status(200).send({
        permitted: decision.permitted,
        evaluation: decision.evaluation!,
    });
}

const MSG_ACCESS_DENIED = 'Access denied by policy';
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

async function put_content(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesPutContentSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesPutContentSchema>,
) {
    const resource = await Resource.findByPk(request.params.resourceId, {
        attributes: [...RESOURCE_VIEW_ATTRIBUTES, 'UserId'],
    });
    if (resource === null) return reply.status(404).send();
    if (resource.UserId !== request.user.id)
        return reply.status(403).send({ errors: [MSG_NOT_AUTHORIZED] });

    const requestedFilename = request.query.filename;
    if (requestedFilename !== undefined && /["\\\r\n]/.test(requestedFilename))
        return reply.status(400).send({
            errors: [
                'filename may not contain quotes, backslashes, or newlines',
            ],
        });

    const body = request.body;
    if (!Buffer.isBuffer(body) || body.length === 0)
        return reply
            .status(400)
            .send({ errors: ['a content body is required'] });

    resource.set({
        content: body,
        // Caller-declared, not the request's real Content-Type; safe to echo
        // since download always sends attachment + nosniff.
        contentType: request.query.contentType ?? DEFAULT_CONTENT_TYPE,
        contentSize: body.length,
        contentFilename: request.query.filename ?? null,
    });
    await resource.save();

    await logEvent('resource.content.upload', request.user.id, {
        resourceId: resource.id,
        size: body.length,
    });
    return reply
        .status(200)
        .send(resourceViewWithUser(resource, resource.UserId));
}

async function get_content(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesGetContentSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesGetContentSchema>,
) {
    // Two queries on purpose: decide first, load bytes second. Fetching up to
    // 32MB for a request about to 403 is what this handler must avoid.
    const resource = await Resource.findByPk(request.params.resourceId, {
        attributes: [...RESOURCE_VIEW_ATTRIBUTES, 'UserId'],
    });
    if (resource === null) return reply.status(404).send();
    if (resource.contentSize === null) return reply.status(404).send();

    if (resource.UserId !== request.user.id) {
        let decision;
        try {
            decision = await decideAccess(request.user.id, {
                id: resource.id,
                attrs: resource.attrs as BartAttrs,
                UserId: resource.UserId,
            });
        } catch (error) {
            const mapped = mapEvaluatorError(error);
            if (mapped !== null) {
                log(`[content] ${(error as Error).message}`);
                return reply
                    .status(mapped.status)
                    .send({ errors: mapped.errors });
            }
            const stored = storedPolicyFailure('content', error);
            if (stored !== null)
                return reply.status(500).send({ errors: stored });
            throw error;
        }

        await logEvent('resource.download', request.user.id, {
            resourceId: resource.id,
            permitted: decision.permitted,
        });
        if (!decision.permitted)
            return reply.status(403).send({ errors: [MSG_ACCESS_DENIED] });
    } else {
        await logEvent('resource.download', request.user.id, {
            resourceId: resource.id,
            permitted: true,
        });
    }

    const withBytes = await Resource.findByPk(resource.id, {
        attributes: ['content'],
    });
    if (withBytes === null || withBytes.content === null)
        return reply.status(404).send();

    const filename = resource.contentFilename ?? 'download';
    // The schema's `response` has no 200 key, so `.status(200)` is
    // unrepresentable in the typed reply; hence the untyped escape hatch.
    return (
        (reply as unknown as FastifyReply)
            .status(200)
            .header(
                'content-type',
                resource.contentType ?? DEFAULT_CONTENT_TYPE,
            )
            // The buffer just read, not the earlier contentSize: a
            // re-upload in between could send a mismatched length and hang.
            .header('content-length', String(withBytes.content.length))
            // `attachment` plus `nosniff` is what stops an echoed, caller-supplied
            // MIME type from becoming stored XSS.
            .header('content-disposition', contentDispositionHeader(filename))
            .header('x-content-type-options', 'nosniff')
            .send(withBytes.content)
    );
}

async function delete_content(
    this: FastifyInstance,
    request: FastifyRequestTypebox<typeof ResourcesDeleteContentSchema>,
    reply: FastifyReplyTypebox<typeof ResourcesDeleteContentSchema>,
) {
    const resource = await Resource.findByPk(request.params.resourceId, {
        attributes: [...RESOURCE_VIEW_ATTRIBUTES, 'UserId'],
    });
    if (resource === null) return reply.status(404).send();
    if (resource.UserId !== request.user.id)
        return reply.status(403).send({ errors: [MSG_NOT_AUTHORIZED] });

    resource.set({
        content: null,
        contentType: null,
        contentSize: null,
        contentFilename: null,
    });
    await resource.save();

    await logEvent('resource.content.delete', request.user.id, {
        resourceId: resource.id,
    });
    return reply
        .status(200)
        .send(resourceViewWithUser(resource, resource.UserId));
}

export default {
    get_all,
    get_facets,
    get_one,
    create_new,
    patch_one,
    delete_one,
    access_one,
    custom_access,
    put_content,
    get_content,
    delete_content,
};
