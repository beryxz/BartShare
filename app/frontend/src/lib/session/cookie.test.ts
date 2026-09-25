import { describe, expect, it } from 'vitest';
import { readUserCookie } from './cookie';

describe('readUserCookie', () => {
    it('reads the user cookie from a document.cookie string', () => {
        expect(readUserCookie('user=abc-123')).toBe('abc-123');
    });

    it('finds it among other cookies', () => {
        expect(readUserCookie('theme=dark; user=abc-123; other=x')).toBe(
            'abc-123',
        );
    });

    it('does not match a cookie whose name merely ends in user', () => {
        expect(readUserCookie('lastuser=abc-123')).toBeNull();
    });

    it('returns null when absent or empty', () => {
        expect(readUserCookie('theme=dark')).toBeNull();
        expect(readUserCookie('')).toBeNull();
        expect(readUserCookie('user=')).toBeNull();
    });

    it('decodes percent-encoded values', () => {
        expect(readUserCookie('user=a%20b')).toBe('a b');
    });
});
