import { apiSend } from '@/lib/api/client';
import { ApiUser } from '@/lib/api/types';
import { BartAttrs } from '@/lib/bart/types';

/**
 * `POST /users` is public: there is no login, so creating a party cannot
 * require being one. `rules` is always empty here, but that is no free pass:
 * a party's `attrs` are half the assembled policy, so signup still reaches the
 * evaluator and can fail with a 400 or a 503.
 */
export function createUser(body: {
    attrs: BartAttrs;
    rules: string[];
}): Promise<ApiUser> {
    return apiSend<ApiUser>('POST', '/users', body);
}
