import { apiGet, apiSend } from '@/lib/api/client';
import { pageOf } from '@/lib/api/page';
import {
    ApiContext,
    ApiGroup,
    ApiResource,
    ApiUser,
    Paginated,
} from '@/lib/api/types';
import { toPolicyRule } from '@/lib/bart/parse';
import { PolicyRule } from '@/lib/bart/rule';
import { BartAttrs } from '@/lib/bart/types';
import { AccountSummary } from './accountSummary';

export function getMe(): Promise<ApiUser> {
    return apiGet<ApiUser>('/me');
}

export function getMyContext(): Promise<ApiContext> {
    return apiGet<ApiContext>('/me/context');
}

/**
 * `attrs` and `rules` are opaque: whichever field is supplied replaces its
 * stored value wholesale, and an omitted field is left untouched.
 *
 * `rules` is validated by the evaluator, so a syntax error comes back as
 * `400 {errors: ["rules: line L:C …"]}`. An empty `rules` is no free pass: the
 * assembled policy still goes to the evaluator, and a party's own `attrs` are
 * half of it, so deleting the last rule can fail with a 400 or a 503.
 */
export function patchMe(body: {
    attrs?: BartAttrs;
    rules?: string[];
}): Promise<ApiUser> {
    return apiSend<ApiUser>('PATCH', '/me', body);
}

/**
 * Rules arrive as `.bart` text (`User.rules` is a `string[]`), so each is
 * parsed back into blocks here; `ast === null` means the parser said no.
 *
 * `source` stays the server's text verbatim, never the reprinted form, or
 * opening the page would rewrite every rule in the policy. Ids are positional,
 * because position is the only identity a bare `string[]` offers.
 */
export function toPolicyRules(sources: string[]): PolicyRule[] {
    return sources.map((source, i) => toPolicyRule(`rule-${i + 1}`, source));
}

/**
 * Deletes the acting user.
 *
 * Unlike a rules-carrying `PATCH /me` this never reaches the evaluator, so
 * there is no 503 case: the realistic failure is a 404, when the row has
 * already gone under a switch. The caller must revalidate the session's user
 * list, on `SessionProvider`'s unscoped `USERS_KEY`, which no key reachable
 * from here touches.
 */
export function deleteMe(): Promise<ApiUser> {
    return apiSend<ApiUser>('DELETE', '/me');
}

/**
 * The counts behind the delete confirmation, from the first page of each list.
 *
 * Only the envelope's total is wanted, so this asks for one page rather than
 * walking every page as `fetchAllPages` does: the rows are thrown away.
 */
export async function getAccountSummary(): Promise<AccountSummary> {
    const [resources, connections, groups] = await Promise.all([
        apiGet<Paginated<ApiResource>>('/me/resources'),
        apiGet<Paginated<ApiUser>>('/me/connections'),
        apiGet<Paginated<ApiGroup>>('/me/groups'),
    ]);

    return {
        resources: pageOf(resources).total,
        connections: pageOf(connections).total,
        groups: pageOf(groups).total,
    };
}
