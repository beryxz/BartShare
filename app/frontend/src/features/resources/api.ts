import { apiDownload, apiGet, apiSend, apiUpload } from '@/lib/api/client';
import { pageOf, PagedList } from '@/lib/api/page';
import { withQuery } from '@/lib/api/query';
import {
    ApiResource,
    Facet,
    Paginated,
    ResourceMetadata,
    RuleCoverageResponse,
    ScanInfo,
} from '@/lib/api/types';
import { BartAttrs } from '@/lib/bart/types';

export type ResourceValues = { attrs: BartAttrs; metadata: ResourceMetadata };

type Params = Record<string, string | number>;

/**
 * Identity is the `user` cookie, so none of these take a user id, but the
 * acting user is still part of every SWR key, which is what keeps one user's
 * cache from being served under another's identity.
 *
 * Filtering and paging are the server's job now: `params` carries `page` plus
 * whatever filters the screen has set, and the response's `page` envelope
 * describes the FILTERED set rather than the corpus.
 */
export async function listMine(
    params: Params,
): Promise<PagedList<ApiResource>> {
    return pageOf(
        await apiGet<Paginated<ApiResource>>(
            withQuery('/me/resources', params),
        ),
    );
}

export async function listAll(params: Params): Promise<PagedList<ApiResource>> {
    return pageOf(
        await apiGet<Paginated<ApiResource>>(withQuery('/resources', params)),
    );
}

/**
 * Everything owned by someone else that the engine permits right now. There
 * are no stored grants, so this is a live evaluation per candidate rather
 * than a lookup, which is why the response carries `scan`.
 *
 * Filters narrow the CANDIDATE set before evaluation, so `scan.total` now
 * counts candidates matching the filter, and filtering makes the scan cheaper
 * rather than more expensive.
 */
export async function listSharedWith(
    params: Params,
): Promise<PagedList<ApiResource> & { scan: ScanInfo }> {
    const response = await apiGet<Paginated<ApiResource> & { scan: ScanInfo }>(
        withQuery('/me/shared', params),
    );
    return { ...pageOf(response), scan: response.scan };
}

/**
 * The attribute vocabulary across the whole matching set, not just the page in
 * hand, which is the point: chips derived from one page would offer a
 * vocabulary that contradicts the results.
 */
export async function listResourceFacets(params: Params): Promise<Facet[]> {
    const response = await apiGet<{ facets: Facet[] }>(
        withQuery('/resources/facets', params),
    );
    return response.facets;
}

export async function listMyResourceFacets(params: Params): Promise<Facet[]> {
    const response = await apiGet<{ facets: Facet[] }>(
        withQuery('/me/resources/facets', params),
    );
    return response.facets;
}

/**
 * The party attribute vocabulary, the same shape as the resource facets.
 *
 * Lives here rather than in `features/network/api.ts` because it exists for
 * the same reason its siblings do, and a caller wanting "the vocabulary for
 * this editor" should find them together.
 */
export async function listUserFacets(params: Params): Promise<Facet[]> {
    const response = await apiGet<{ facets: Facet[] }>(
        withQuery('/users/facets', params),
    );
    return response.facets;
}

/**
 * How many of the caller's resources each rule pattern covers.
 *
 * The patterns are sent already parsed because the backend has no `.bart`
 * parser and must not grow one; the client parses every rule anyway to decide
 * which editor it opens in. The server contributes the part the client cannot
 * have: the complete resource set, so the denominator is exact.
 */
export function fetchRuleCoverage(
    patterns: BartAttrs[],
): Promise<RuleCoverageResponse> {
    return apiSend<RuleCoverageResponse>('POST', '/me/rules/coverage', {
        patterns,
    });
}

export function createResource(values: ResourceValues): Promise<ApiResource> {
    return apiSend<ApiResource>('POST', '/resources', values);
}

export function updateResource(
    id: string,
    values: ResourceValues,
): Promise<ApiResource> {
    // Each field replaces its stored value wholesale: there is no deep merge.
    return apiSend<ApiResource>('PATCH', `/resources/${id}`, values);
}

export function deleteResource(id: string): Promise<ApiResource> {
    return apiSend<ApiResource>('DELETE', `/resources/${id}`);
}

/**
 * `File.type` is omitted when empty so the backend applies its own
 * `application/octet-stream` default; `File.name` becomes the stored filename,
 * and a quote, backslash or newline in it is a `400` (it is interpolated into
 * a `Content-Disposition` header on download).
 */
export function uploadContent(id: string, file: File): Promise<ApiResource> {
    return apiUpload<ApiResource>(`/resources/${id}/content`, file, {
        filename: file.name,
        contentType: file.type || undefined,
    });
}

/** Idempotent by design: clearing absent content is a 200, never a 404. */
export function clearContent(id: string): Promise<ApiResource> {
    return apiSend<ApiResource>('DELETE', `/resources/${id}/content`);
}

/**
 * Access-gated: the owner short-circuits, everyone else goes through a live
 * evaluation, and a denial is a `403`, unlike `/access`, which answers a
 * question and returns `200 {permitted: false}`. A download performs an
 * action, so refusal is an error.
 */
export function downloadContent(
    id: string,
): Promise<{ blob: Blob; filename: string | null }> {
    return apiDownload(`/resources/${id}/content`);
}
