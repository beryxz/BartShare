import { describe, expect, it } from 'vitest';
import { fileTypeLabel, formatBytes } from './format';

describe('formatBytes', () => {
    it('reports a sub-kilobyte count in bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(812)).toBe('812 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });

    it('switches unit at the 1024 boundary', () => {
        expect(formatBytes(1024)).toBe('1 KB');
    });

    it('keeps one decimal below ten in a unit', () => {
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(1468006)).toBe('1.4 MB');
    });

    it('rounds to an integer at or above ten in a unit', () => {
        expect(formatBytes(245760)).toBe('240 KB');
    });

    it('strips a trailing .0 rather than printing it', () => {
        expect(formatBytes(2048)).toBe('2 KB');
    });

    it('stops scaling at gigabytes', () => {
        expect(formatBytes(1073741824)).toBe('1 GB');
        expect(formatBytes(5 * 1024 ** 4)).toBe('5120 GB');
    });

    it('returns 0 B for input that is not a usable size', () => {
        expect(formatBytes(-5)).toBe('0 B');
        expect(formatBytes(Number.NaN)).toBe('0 B');
        expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
    });
});

describe('fileTypeLabel', () => {
    it('maps a known MIME type through the table', () => {
        expect(fileTypeLabel('application/pdf')).toBe('PDF');
        expect(fileTypeLabel('image/jpeg')).toBe('JPG');
        expect(fileTypeLabel('image/svg+xml')).toBe('SVG');
    });

    it('ignores MIME parameters', () => {
        expect(fileTypeLabel('text/plain; charset=utf-8')).toBe('TXT');
    });

    it('uppercases an unmapped but short subtype', () => {
        expect(fileTypeLabel('text/html')).toBe('HTML');
        expect(fileTypeLabel('image/webp')).toBe('WEBP');
    });

    it('strips an x- or vnd. subtype prefix', () => {
        expect(fileTypeLabel('application/x-tar')).toBe('TAR');
        expect(fileTypeLabel('application/vnd.rar')).toBe('RAR');
    });

    it('falls back to the filename extension when the subtype is unusable', () => {
        expect(fileTypeLabel('application/octet-stream', 'report.pdf')).toBe(
            'PDF',
        );
        expect(fileTypeLabel('application/vnd.ms-excel', 'budget.xls')).toBe(
            'XLS',
        );
        expect(fileTypeLabel('application/octet-stream', 'a.tar.gz')).toBe(
            'GZ',
        );
    });

    it('returns FILE when neither the type nor the name says anything', () => {
        expect(fileTypeLabel('application/octet-stream')).toBe('FILE');
        expect(fileTypeLabel('application/octet-stream', null)).toBe('FILE');
        expect(fileTypeLabel('application/octet-stream', 'notes')).toBe('FILE');
        expect(fileTypeLabel('application/octet-stream', 'data.sqlite3')).toBe(
            'FILE',
        );
    });

    it('treats a leading dot as part of the name, not an extension', () => {
        expect(fileTypeLabel('application/octet-stream', '.env')).toBe('FILE');
    });
});
