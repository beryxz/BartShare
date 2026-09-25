import { describe, expect, it } from 'vitest';
import {
    EVENTS_KEY,
    SCENARIOS_KEY,
    STATUS_KEY,
    swrKey,
    USERS_KEY,
} from '@/lib/api/keys';
import { isDatabaseScopedKey } from './cache';

describe('isDatabaseScopedKey', () => {
    it('spares the keys no write can invalidate', () => {
        expect(isDatabaseScopedKey(SCENARIOS_KEY)).toBe(false);
        expect(isDatabaseScopedKey(STATUS_KEY)).toBe(false);
    });

    it('drops the event log, which a seed and a reset both change', () => {
        expect(isDatabaseScopedKey(`${EVENTS_KEY}?page=1`)).toBe(true);
    });

    it('drops the party list, which a seed or reset rewrites, and every user-scoped key, tuples and all', () => {
        expect(isDatabaseScopedKey(USERS_KEY)).toBe(true);
        expect(isDatabaseScopedKey(['user-id', '/resources'])).toBe(true);
        expect(isDatabaseScopedKey(swrKey('a-user-id', '/me/resources'))).toBe(
            true,
        );
        expect(
            isDatabaseScopedKey(
                swrKey('a-user-id', '/shared', { page: 2, q: 'notes' }),
            ),
        ).toBe(true);
    });

    it('drops a key SWR cannot name, since dropping is the safe default', () => {
        // SWR passes the filter `cache.get(key)._k`, which is undefined for an
        // entry no mounted hook ever claimed. Such an entry belongs to nobody,
        // so it is dropped rather than kept alive.
        expect(isDatabaseScopedKey(undefined)).toBe(true);
    });
});
