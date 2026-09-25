import type { ApiUser } from '@/lib/api/types';

export const alice: ApiUser = {
    id: 'u-1',
    attrs: { name: 'alice' },
    rules: [],
};

export const bob: ApiUser = { id: 'u-2', attrs: { name: 'bob' }, rules: [] };
