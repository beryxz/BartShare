import { describe, expect, it } from 'vitest';
import { filenameFrom } from './content';

describe('filenameFrom', () => {
    it('prefers the RFC 5987 filename* parameter', () => {
        // The ASCII fallback is unusable here: a fully non-ASCII name leaves
        // `filename="download"`, so reading it would lose the real name.
        expect(
            filenameFrom(
                `attachment; filename="download"; filename*=UTF-8''%E6%96%87%E4%BB%B6`,
            ),
        ).toBe('文件');
    });

    it('reads the quoted ASCII filename when there is no filename*', () => {
        expect(filenameFrom('attachment; filename="notes.txt"')).toBe(
            'notes.txt',
        );
    });

    it('reads an unquoted filename', () => {
        expect(filenameFrom('attachment; filename=notes.txt')).toBe(
            'notes.txt',
        );
    });

    it('falls back to the ASCII form when the escape is malformed', () => {
        expect(
            filenameFrom(
                `attachment; filename="notes.txt"; filename*=UTF-8''%E0%A4%A`,
            ),
        ).toBe('notes.txt');
    });

    it('returns null when the header is absent', () => {
        expect(filenameFrom(null)).toBeNull();
    });

    it('returns null when the header carries no filename', () => {
        expect(filenameFrom('attachment')).toBeNull();
    });
});
