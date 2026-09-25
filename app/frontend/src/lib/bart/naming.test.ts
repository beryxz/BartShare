import { describe, expect, it } from 'vitest';
import { resourceName, userName } from './naming';

describe('resourceName', () => {
    it('reads metadata.name', () => {
        const r = {
            id: 'aaaaaaaa-1111',
            metadata: { name: 'ADS lecture notes' },
        };
        expect(resourceName(r)).toBe('ADS lecture notes');
    });

    it('falls back to a short id when the name is missing', () => {
        // The backend requires a non-empty metadata.name at write time, so
        // this is only reachable for a row written before that validation:
        // never a normal case, but it must not render as blank.
        expect(resourceName({ id: 'aaaaaaaa-1111', metadata: {} })).toBe(
            'Resource aaaaaaaa',
        );
    });

    it('falls back to a short id when the name is whitespace only', () => {
        expect(
            resourceName({ id: 'aaaaaaaa-1111', metadata: { name: '   ' } }),
        ).toBe('Resource aaaaaaaa');
    });
});

describe('userName', () => {
    it('prefers the username attribute', () => {
        expect(
            userName({ id: 'bbbbbbbb-2222', attrs: { username: 'mary' } }),
        ).toBe('mary');
    });

    it('falls back to the first non-reserved attribute value', () => {
        expect(
            userName({
                id: 'bbbbbbbb-2222',
                attrs: { userId: 'x', degreeProgram: 'cs' },
            }),
        ).toBe('cs');
    });

    it('falls back to a short id', () => {
        expect(userName({ id: 'bbbbbbbb-2222', attrs: {} })).toBe(
            'User bbbbbbbb',
        );
    });
});
