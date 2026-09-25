import { describe, expect, it } from 'vitest';
import { ApiUser } from '@/lib/api/types';
import { chooseActingUser } from './choose';

const users = [
    { id: 'a', attrs: { username: 'david' }, rules: [] },
    { id: 'b', attrs: { username: 'mary' }, rules: [] },
] as unknown as ApiUser[];

describe('chooseActingUser', () => {
    it('keeps a cookie that names a known user', () => {
        expect(chooseActingUser(users, 'b')?.id).toBe('b');
    });

    it('falls back to the first user when the cookie names a deleted one', () => {
        expect(chooseActingUser(users, 'gone')?.id).toBe('a');
    });

    it('falls back to the first user when there is no cookie', () => {
        expect(chooseActingUser(users, null)?.id).toBe('a');
    });

    it('is null on an empty database', () => {
        expect(chooseActingUser([], 'a')).toBeNull();
    });
});
