import { describe, expect, it } from 'vitest';
import { swrKey } from './keys';

describe('swrKey', () => {
    it('scopes the key to the acting user so switching swaps caches', () => {
        expect(swrKey('u1', '/me/resources')).toEqual(['u1', '/me/resources']);
        expect(swrKey('u2', '/me/resources')).toEqual(['u2', '/me/resources']);
    });

    it('serialises params into the path so they are part of the key', () => {
        expect(swrKey('u1', '/resources', { page: 2 })).toEqual([
            'u1',
            '/resources?page=2',
        ]);
    });

    it('orders params deterministically', () => {
        expect(swrKey('u1', '/g', { b: '2', a: '1' })).toEqual([
            'u1',
            '/g?a=1&b=2',
        ]);
    });

    it('returns null with no acting user, which tells SWR not to fetch', () => {
        expect(swrKey(null, '/me/resources')).toBeNull();
    });
});
