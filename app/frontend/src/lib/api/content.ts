/**
 * `GET /resources/:id/content` sends both RFC 6266 forms. `filename*` wins:
 * for a name with no ASCII in it the `filename` fallback is the literal string
 * "download". An unreadable header degrades the name, never the download.
 */
export function filenameFrom(header: string | null): string | null {
    if (!header) return null;

    const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (extended) {
        try {
            return decodeURIComponent(extended[1].trim());
        } catch {
            // A malformed escape falls through to the ASCII form below.
        }
    }

    const quoted = /filename="([^"]*)"/i.exec(header);
    const bare = /filename=([^;]+)/i.exec(header);
    const name = (quoted?.[1] ?? bare?.[1] ?? '').trim();
    return name === '' ? null : name;
}

/** Hands downloaded bytes to the browser. DOM-bound, and beside the parser
 *  rather than in a component so the pure half stays testable. */
export function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
