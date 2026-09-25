'use strict';

import { FastifyInstance } from 'fastify';
import { Sequelize } from 'sequelize';
import t from 'tap';
import { bootApi } from '../support/api-harness';
import config from '../../src/config';
import { APP_LIMITS } from '../../src/config';
import { Resource, User } from '../../src/models/models';
import { startFakeEvaluator } from '../support/fake-evaluator';

let dbInstance: Sequelize;
let apiServer: FastifyInstance;
let owner: User;
let caller: User;
let resourceA: Resource;
let resourceB: Resource;
let previousUrl: string;

const PAYLOAD = Buffer.from('hello bart');

t.before(async () => {
    ({ db: dbInstance, api: apiServer } = await bootApi());

    owner = await User.create({ attrs: { username: 'c-owner' }, rules: [] });
    caller = await User.create({ attrs: { username: 'c-caller' }, rules: [] });
    resourceA = await Resource.create({
        attrs: { type: 'lectureNotes' },
        metadata: { name: 'Notes' },
        UserId: owner.id,
    });
    // Kept separate from resourceA so tests below can freely overwrite its
    // content without disturbing the ordering the download tests rely on.
    resourceB = await Resource.create({
        attrs: { type: 'lectureNotes' },
        metadata: { name: 'More notes' },
        UserId: owner.id,
    });
    previousUrl = config.EVALUATOR_URL;
});
t.after(async () => {
    config.EVALUATOR_URL = previousUrl;
    await apiServer.close();
    await dbInstance.close();
});

async function upload(userId: string, query = '?filename=notes.txt') {
    return apiServer.inject({
        method: 'PUT',
        url: `/api/v1/resources/${resourceA.id}/content${query}`,
        cookies: { user: userId },
        headers: { 'content-type': 'application/octet-stream' },
        payload: PAYLOAD,
    });
}

t.test('the owner uploads content', async t => {
    t.plan(4);

    const response = await upload(owner.id);
    const body = response.json();

    t.equal(response.statusCode, 200, 'status code');
    t.equal(body.content.size, PAYLOAD.length, 'size is server-derived');
    t.equal(body.content.filename, 'notes.txt', 'filename from the query');
    t.equal(
        body.content.type,
        'application/octet-stream',
        'type from the header',
    );
});

t.test('a non-owner may not upload', async t => {
    t.plan(1);
    const response = await upload(caller.id);
    t.equal(response.statusCode, 403, 'status code');
});

t.test('a non-owner may not delete content', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: caller.id },
    });
    t.equal(response.statusCode, 403, 'status code');

    // A 403 that still wiped the bytes would pass a status-only assertion.
    const reloaded = await Resource.findByPk(resourceA.id);
    t.equal(
        reloaded?.content?.toString(),
        'hello bart',
        'content survives the rejected delete',
    );
});

t.test('an empty body is rejected', async t => {
    t.plan(1);
    const response = await apiServer.inject({
        method: 'PUT',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: Buffer.alloc(0),
    });
    t.equal(response.statusCode, 400, 'status code');
});

t.test('a filename containing a quote is rejected', async t => {
    t.plan(2);

    // A different payload than PAYLOAD, so a guard that fires too late would
    // visibly change the stored content to this instead.
    const response = await apiServer.inject({
        method: 'PUT',
        url:
            `/api/v1/resources/${resourceA.id}/content` +
            `?filename=${encodeURIComponent('evil".txt')}`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: Buffer.from('should never be stored'),
    });
    t.equal(response.statusCode, 400, 'status code');

    const reloaded = await Resource.findByPk(resourceA.id);
    t.equal(
        reloaded?.content?.toString(),
        'hello bart',
        'content is unchanged: the guard fires before the write',
    );
});

t.test('a filename containing a newline is rejected', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'PUT',
        url:
            `/api/v1/resources/${resourceA.id}/content` +
            `?filename=${encodeURIComponent('evil\n.txt')}`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: Buffer.from('should never be stored'),
    });
    t.equal(response.statusCode, 400, 'status code');

    const reloaded = await Resource.findByPk(resourceA.id);
    t.equal(
        reloaded?.content?.toString(),
        'hello bart',
        'content is unchanged: the guard fires before the write',
    );
});

t.test('an oversize body is rejected', async t => {
    t.plan(1);

    // One byte past the limit; this really does allocate ~32MB, the only way
    // to exercise the route's bodyLimit.
    const oversize = Buffer.alloc(
        APP_LIMITS.resources.maxContentBytes + 1,
        0x61,
    );

    const response = await apiServer.inject({
        method: 'PUT',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: oversize,
    });
    t.equal(response.statusCode, 413, 'status code');
});

t.test('a non-ASCII filename uploads and downloads', async t => {
    t.plan(5);

    // Every character is above 0x7e, outside what Node's header-value validator
    // accepts bare, and fully strips: the ASCII fallback must read "download".
    const filename = '文件';

    const upload = await apiServer.inject({
        method: 'PUT',
        url:
            `/api/v1/resources/${resourceB.id}/content` +
            `?filename=${encodeURIComponent(filename)}`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: PAYLOAD,
    });
    t.equal(upload.statusCode, 200, 'upload status code');
    t.equal(upload.json().content.filename, filename, 'filename stored as-is');

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceB.id}/content`,
        cookies: { user: owner.id },
    });
    t.equal(response.statusCode, 200, 'download status code');
    t.equal(response.rawPayload.toString(), 'hello bart', 'bytes intact');
    t.equal(
        response.headers['content-disposition'],
        `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'both the ASCII fallback and the RFC 5987 encoded form are present',
    );
});

t.test('a declared content type round-trips', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'PUT',
        url: `/api/v1/resources/${resourceB.id}/content?contentType=text/plain`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: PAYLOAD,
    });
    t.equal(
        response.json().content.type,
        'text/plain',
        'declared type is stored',
    );
});

t.test('a malformed content type is rejected', async t => {
    t.plan(2);

    const response = await apiServer.inject({
        method: 'PUT',
        url: `/api/v1/resources/${resourceB.id}/content?contentType=not-a-mime-type`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: PAYLOAD,
    });
    t.equal(response.statusCode, 400, 'status code');

    const reloaded = await Resource.findByPk(resourceB.id);
    t.equal(
        reloaded?.contentType,
        'text/plain',
        'the previously stored type is unchanged',
    );
});

t.test('omitting contentType defaults to octet-stream', async t => {
    t.plan(1);

    const response = await apiServer.inject({
        method: 'PUT',
        url: `/api/v1/resources/${resourceB.id}/content`,
        cookies: { user: owner.id },
        headers: { 'content-type': 'application/octet-stream' },
        payload: PAYLOAD,
    });
    t.equal(
        response.json().content.type,
        'application/octet-stream',
        'default applies when the query parameter is omitted',
    );
});

t.test('the owner downloads without an evaluation', async t => {
    t.plan(5);
    config.EVALUATOR_URL = 'http://127.0.0.1:1'; // would fail if called

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: owner.id },
    });

    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.rawPayload.toString(), 'hello bart', 'the bytes');
    t.equal(
        response.headers['content-disposition'],
        'attachment; filename="notes.txt"; filename*=UTF-8\'\'notes.txt',
        'always an attachment, in both RFC 6266 forms',
    );
    t.equal(
        response.headers['x-content-type-options'],
        'nosniff',
        'nosniff is set',
    );
    t.equal(
        response.headers['content-type'],
        'application/octet-stream',
        'the stored type',
    );
});

t.test('a permitted non-owner downloads', async t => {
    t.plan(2);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: true,
            requests: [],
            trace: '',
            scenario: '',
        }),
    });
    config.EVALUATOR_URL = fake.url;

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: caller.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.rawPayload.toString(), 'hello bart', 'the bytes');

    await fake.close();
});

t.test('a denied non-owner gets 403, not 200', async t => {
    t.plan(2);
    const fake = await startFakeEvaluator({
        evaluate: () => ({
            permitted: false,
            requests: [],
            trace: '',
            scenario: '',
        }),
    });
    config.EVALUATOR_URL = fake.url;

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: caller.id },
    });
    t.equal(
        response.statusCode,
        403,
        'a download is an action, not a question',
    );
    t.match(response.json().errors[0], /policy/, 'says why');

    await fake.close();
});

t.test('an unreachable evaluator is a 503', async t => {
    t.plan(1);
    config.EVALUATOR_URL = 'http://127.0.0.1:1';

    const response = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: caller.id },
    });
    t.equal(response.statusCode, 503, 'status code');
});

t.test(
    'a stored row that cannot be emitted is a 500, not a leaked emitter message',
    async t => {
        t.plan(2);
        // assemblePolicySystem emits the owner's policy before ever calling the
        // evaluator, so this throws regardless of where EVALUATOR_URL points.
        const badOwner = await User.create({
            attrs: { username: 'c-bad-owner', bad: null } as unknown as Record<
                string,
                unknown
            >,
            rules: [],
        });
        const badResource = await Resource.create({
            attrs: { type: 'lectureNotes' },
            metadata: { name: 'Bad notes' },
            UserId: badOwner.id,
        });
        await apiServer.inject({
            method: 'PUT',
            url: `/api/v1/resources/${badResource.id}/content?filename=n.txt`,
            cookies: { user: badOwner.id },
            headers: { 'content-type': 'application/octet-stream' },
            payload: PAYLOAD,
        });

        const response = await apiServer.inject({
            method: 'GET',
            url: `/api/v1/resources/${badResource.id}/content`,
            cookies: { user: caller.id },
        });

        t.equal(response.statusCode, 500, 'status code');
        t.notMatch(
            response.json().errors[0],
            /BartEmitError|values must be a string/,
            'the emitter-internal message is not leaked verbatim',
        );

        await badResource.destroy({ force: true });
        await badOwner.destroy({ force: true });
    },
);

t.test('deleting content leaves the resource', async t => {
    t.plan(3);

    const response = await apiServer.inject({
        method: 'DELETE',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: owner.id },
    });
    t.equal(response.statusCode, 200, 'status code');
    t.equal(response.json().content, null, 'content is cleared');

    const missing = await apiServer.inject({
        method: 'GET',
        url: `/api/v1/resources/${resourceA.id}/content`,
        cookies: { user: owner.id },
    });
    t.equal(missing.statusCode, 404, 'downloading nothing is a 404');
});
