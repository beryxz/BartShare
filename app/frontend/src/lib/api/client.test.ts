import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDownload, apiGet, apiSend, apiUpload } from './client';

function mockFetch(
    status: number,
    body: unknown,
    contentType = 'application/json',
) {
    const response = {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => contentType },
        json: async () => body,
        text: async () => JSON.stringify(body),
    };
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => response),
    );
}

afterEach(() => vi.unstubAllGlobals());

describe('apiGet', () => {
    it('prefixes /api/v1 and returns the parsed body', async () => {
        mockFetch(200, { id: 'u1' });
        await expect(apiGet('/users/u1')).resolves.toEqual({ id: 'u1' });
        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/users/u1',
            expect.objectContaining({ credentials: 'include' }),
        );
    });

    it('throws ApiError carrying the backend error array', async () => {
        mockFetch(403, { errors: ['Not authorized'] });
        await expect(apiGet('/resources/r1')).rejects.toMatchObject({
            status: 403,
            errors: ['Not authorized'],
        });
    });

    it('synthesises a message for an empty-body 404', async () => {
        mockFetch(404, null, 'text/plain');
        const error = (await apiGet('/nope').catch(e => e)) as ApiError;
        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(404);
        expect(error.errors).toEqual(['Not found']);
    });

    it('synthesises a message for an empty-body 401', async () => {
        mockFetch(401, null, 'text/plain');
        const error = (await apiGet('/me').catch(e => e)) as ApiError;
        expect(error.errors).toEqual(['Not authenticated']);
    });

    it('synthesises a message for an empty-body 409', async () => {
        // POST /me/connections/:id and POST /me/groups/:id answer an
        // empty 409 when the connection/membership already exists.
        mockFetch(409, null, 'text/plain');
        const error = (await apiGet('/me/connections/u2').catch(
            e => e,
        )) as ApiError;
        expect(error.errors).toEqual([
            'Already connected or joined: reload to see the current state',
        ]);
    });

    it('returns undefined for a 204', async () => {
        mockFetch(204, null, 'text/plain');
        await expect(
            apiSend('DELETE', '/me/connections/u2'),
        ).resolves.toBeUndefined();
    });
});

describe('apiSend', () => {
    it('sends JSON with the right method and header', async () => {
        mockFetch(201, { id: 'r1' });
        await apiSend('POST', '/resources', { attrs: { type: 'notes' } });
        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/resources',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ attrs: { type: 'notes' } }),
            }),
        );
    });
});

describe('apiUpload', () => {
    it('PUTs the raw body with filename and type in the query', async () => {
        mockFetch(200, { id: 'r1' });
        await apiUpload('/resources/r1/content', new Blob(['x']), {
            filename: 'notes.txt',
            contentType: 'text/plain',
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/resources/r1/content?filename=notes.txt&contentType=text%2Fplain',
            expect.objectContaining({
                method: 'PUT',
                credentials: 'include',
                headers: { 'content-type': 'application/octet-stream' },
            }),
        );
    });

    it('omits a parameter that was not given', async () => {
        // An empty File.type must not be sent: the backend rejects a
        // contentType that does not look like a media type, and its own
        // default is application/octet-stream anyway.
        mockFetch(200, { id: 'r1' });
        await apiUpload('/resources/r1/content', new Blob(['x']), {
            filename: 'a.bin',
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/resources/r1/content?filename=a.bin',
            expect.anything(),
        );
    });

    it('sends no query string at all when given no parameters', async () => {
        mockFetch(200, { id: 'r1' });
        await apiUpload('/resources/r1/content', new Blob(['x']));
        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/resources/r1/content',
            expect.anything(),
        );
    });
});

describe('apiDownload', () => {
    it('returns the blob and the filename from Content-Disposition', async () => {
        const blob = new Blob(['bytes']);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                status: 200,
                headers: {
                    get: (header: string) =>
                        header === 'content-disposition'
                            ? `attachment; filename="notes.txt"; filename*=UTF-8''notes.txt`
                            : null,
                },
                blob: async () => blob,
            })),
        );
        await expect(apiDownload('/resources/r1/content')).resolves.toEqual({
            blob,
            filename: 'notes.txt',
        });
    });

    it('throws ApiError with the backend message on a denial', async () => {
        // A denied download is a 403 with a JSON body, unlike /access which
        // answers 200 {permitted: false}.
        mockFetch(403, { errors: ['Access denied by policy'] });
        await expect(
            apiDownload('/resources/r1/content'),
        ).rejects.toMatchObject({
            status: 403,
            errors: ['Access denied by policy'],
        });
    });
});
