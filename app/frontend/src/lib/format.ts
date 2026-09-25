/**
 * Display formatting for values the UI shows but never computes with. Both
 * functions are total: they take whatever the backend recorded about an upload,
 * and a surprising value degrades the label rather than throwing in a render.
 */

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * A byte count in binary units (1 KB = 1024 B). One decimal below ten in a
 * unit, an integer at or above it, and a trailing `.0` stripped, so 2048 bytes
 * reads `2 KB`. The negative and non-finite guard turns a bad row into `0 B`
 * instead of `NaN undefined`.
 */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return `${Math.round(bytes)} B`;

    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit += 1;
    }

    const scaled = value < 10 ? value.toFixed(1) : String(Math.round(value));
    return `${scaled.replace(/\.0$/, '')} ${UNITS[unit]}`;
}

/** The MIME types this app realistically sees, with the token to show for each. */
const MIME_LABELS: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/plain': 'TXT',
    'text/markdown': 'MD',
    'text/csv': 'CSV',
    'application/json': 'JSON',
    'application/zip': 'ZIP',
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
    'image/gif': 'GIF',
    'image/svg+xml': 'SVG',
};

/** A token is usable as a badge label only if it is short and alphanumeric. */
function usableToken(token: string): string | null {
    const upper = token.toUpperCase();
    return /^[A-Z0-9]{1,6}$/.test(upper) ? upper : null;
}

/**
 * A short uppercase token naming a file's kind: `PDF`, `ZIP`, `FILE`. MIME
 * first, filename as fallback, which is what makes `application/octet-stream`
 * resolve through the extension instead of rendering as `OCTET-STREAM`.
 */
export function fileTypeLabel(type: string, filename?: string | null): string {
    const mime = type.trim().toLowerCase().split(';')[0].trim();

    const mapped = MIME_LABELS[mime];
    if (mapped) return mapped;

    const subtype = mime.split('/')[1] ?? '';
    const fromMime = usableToken(subtype.replace(/^(x-|vnd\.)/, ''));
    if (fromMime) return fromMime;

    // `dot > 0`, not `>= 0`: in a dotfile like `.env` the leading dot starts
    // the name, so there is no extension to read.
    const name = filename ?? '';
    const dot = name.lastIndexOf('.');
    const fromName = usableToken(dot > 0 ? name.slice(dot + 1) : '');
    if (fromName) return fromName;

    return 'FILE';
}
