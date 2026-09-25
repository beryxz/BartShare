import { apiUrl } from '@/lib/utils';
import { filenameFrom } from './content';

const BASE = '/api/v1';

/** A non-2xx response, normalised from the backend's `{ errors: string[] }`. */
export class ApiError extends Error {
    readonly status: number;
    readonly errors: string[];

    constructor(status: number, errors: string[]) {
        super(errors[0] ?? `Request failed with status ${status}`);
        this.name = 'ApiError';
        this.status = status;
        this.errors = errors;
    }
}

/**
 * Fallback text for whenever a response is empty or non-JSON, so the UI never
 * shows a blank error. Only reached as a fallback: a real `{errors: [...]}`
 * body always wins, which is what keeps `POST /dev/seed`'s populated 409 from
 * being reported as a duplicate connection.
 */
const EMPTY_BODY_MESSAGES: Record<number, string> = {
    401: 'Not authenticated',
    403: 'Not authorized',
    404: 'Not found',
    409: 'Already connected or joined: reload to see the current state',
};

async function readErrors(res: Response): Promise<string[]> {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        const body = (await res.json().catch(() => null)) as {
            errors?: string[];
        } | null;
        if (body?.errors?.length) return body.errors;
    }
    return [
        EMPTY_BODY_MESSAGES[res.status] ?? `Request failed (${res.status})`,
    ];
}

async function send<T>(
    method: string,
    path: string,
    init: RequestInit = {},
): Promise<T> {
    // `include`, not `same-origin`: a cross-origin NEXT_PUBLIC_API_HOST drops
    // the `user` cookie. `init` spreads first so a caller cannot override it.
    const res = await fetch(apiUrl(`${BASE}${path}`), {
        ...init,
        method,
        credentials: 'include',
    });

    if (!res.ok) throw new ApiError(res.status, await readErrors(res));
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return send<T>(method, path, {
        headers:
            body === undefined ? {} : { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

export function apiGet<T>(path: string): Promise<T> {
    return request<T>('GET', path);
}

export function apiSend<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
): Promise<T> {
    return request<T>(method, path, body);
}

/**
 * Uploads resource content. `PUT /resources/:id/content` takes raw bytes, so
 * filename and MIME type travel as query parameters. An empty `File.type` is
 * omitted rather than sent: the backend rejects an empty string as a malformed
 * media type instead of applying its `application/octet-stream` default.
 */
export function apiUpload<T>(
    path: string,
    file: Blob,
    params: { filename?: string; contentType?: string } = {},
): Promise<T> {
    const query = new URLSearchParams();
    if (params.filename) query.set('filename', params.filename);
    if (params.contentType) query.set('contentType', params.contentType);
    const search = query.toString();

    return send<T>('PUT', search === '' ? path : `${path}?${search}`, {
        headers: { 'content-type': 'application/octet-stream' },
        body: file,
    });
}

/**
 * Downloads resource content. Answers bytes, so it cannot go through `send`,
 * but reuses `readErrors` so a `403` still arrives as an `ApiError` carrying
 * the backend's own message.
 */
export async function apiDownload(
    path: string,
): Promise<{ blob: Blob; filename: string | null }> {
    const res = await fetch(apiUrl(`${BASE}${path}`), {
        method: 'GET',
        credentials: 'include',
    });

    if (!res.ok) throw new ApiError(res.status, await readErrors(res));
    return {
        blob: await res.blob(),
        filename: filenameFrom(res.headers.get('content-disposition')),
    };
}
