import { Resource } from '../models/models';

/**
 * The columns every resource read path selects.
 *
 * `content` is deliberately absent: without this list, a bare `findByPk`
 * would drag up to 32MB through Node. Only the download handler asks for
 * the bytes.
 */
export const RESOURCE_VIEW_ATTRIBUTES = [
    'id',
    'attrs',
    'metadata',
    'contentType',
    'contentSize',
    'contentFilename',
] as const;

export type ResourceContentView = {
    type: string;
    size: number;
    filename: string | null;
} | null;

export type ResourceView = {
    id: string;
    attrs: Record<string, unknown>;
    metadata: Record<string, unknown>;
    content: ResourceContentView;
};

export type ResourceViewWithUser = ResourceView & { user: { id: string } };

/**
 * Whether a row has bytes, decided from `contentSize` rather than `content`.
 *
 * Reading `content` here would defeat RESOURCE_VIEW_ATTRIBUTES: the column is not selected
 * on a list read, so it is `undefined` rather than `null`, and a truthiness test would
 * report "no content" for every row that has some.
 */
function contentView(resource: Resource): ResourceContentView {
    if (resource.contentSize === null || resource.contentSize === undefined)
        return null;
    return {
        type: resource.contentType ?? 'application/octet-stream',
        size: resource.contentSize,
        filename: resource.contentFilename ?? null,
    };
}

export function resourceView(resource: Resource): ResourceView {
    return {
        id: resource.id,
        attrs: resource.attrs,
        metadata: resource.metadata,
        content: contentView(resource),
    };
}

export function resourceViewWithUser(
    resource: Resource,
    userId: string,
): ResourceViewWithUser {
    return { ...resourceView(resource), user: { id: userId } };
}

/**
 * RFC 5987 `attr-char`: letters, digits, and `!#$&+-.^_`|~`. Everything else in a
 * `filename*` value must be percent-encoded.
 */
const RFC5987_SAFE_BYTE = /[A-Za-z0-9!#$&+\-.^_`|~]/;

/** Percent-encodes the UTF-8 bytes of `value` per RFC 5987. */
function encodeRFC5987ValueChars(value: string): string {
    const bytes = Buffer.from(value, 'utf8');
    let out = '';
    for (const byte of bytes) {
        const char = String.fromCharCode(byte);
        out += RFC5987_SAFE_BYTE.test(char)
            ? char
            : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
    return out;
}

/**
 * The ASCII `filename` fallback for `Content-Disposition`: everything
 * outside printable ASCII is dropped, and `"` / `\` are stripped too, since
 * this must be safe on its own even though the upload guard already rejects
 * them. Never empty: falls back to `'download'`.
 */
function asciiFallbackFilename(filename: string): string {
    const safe = filename.replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '');
    const trimmed = safe.trim();
    return trimmed.length > 0 ? trimmed : 'download';
}

/**
 * Builds an RFC 6266 `Content-Disposition` header carrying both forms: an
 * ASCII `filename` fallback and a percent-encoded UTF-8 `filename*`. Node
 * throws `ERR_INVALID_CHAR` on a code point above 0xFF, so a non-Latin-1
 * filename (e.g. CJK) needs the fallback to download at all.
 */
export function contentDispositionHeader(filename: string): string {
    const ascii = asciiFallbackFilename(filename);
    const encoded = encodeRFC5987ValueChars(filename);
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
