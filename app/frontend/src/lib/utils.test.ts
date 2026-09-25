import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from './utils';

afterEach(() => vi.unstubAllEnvs());

describe('apiUrl', () => {
    it('prefixes the configured API host', () => {
        vi.stubEnv('NEXT_PUBLIC_API_HOST', 'http://localhost:8081');
        expect(apiUrl('/api/v1/users/u1')).toBe(
            'http://localhost:8081/api/v1/users/u1',
        );
    });

    it('falls back to a same-origin relative URL when unset', () => {
        vi.stubEnv('NEXT_PUBLIC_API_HOST', undefined);
        expect(apiUrl('/api/v1/users/u1')).toBe('/api/v1/users/u1');
    });

    it('falls back to a same-origin relative URL when set empty', () => {
        vi.stubEnv('NEXT_PUBLIC_API_HOST', '');
        expect(apiUrl('/api/v1/users/u1')).toBe('/api/v1/users/u1');
    });

    it('drops a trailing slash on the host so the path is not doubled', () => {
        vi.stubEnv('NEXT_PUBLIC_API_HOST', 'http://localhost:8081/');
        expect(apiUrl('/api/v1/users/u1')).toBe(
            'http://localhost:8081/api/v1/users/u1',
        );
    });
});
