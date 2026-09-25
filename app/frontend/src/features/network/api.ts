import { apiGet, apiSend } from '@/lib/api/client';
import { pageOf, PagedList } from '@/lib/api/page';
import { fetchAllPages, withQuery } from '@/lib/api/query';
import { ApiGroup, ApiUser, Paginated } from '@/lib/api/types';

/**
 * Connections are mutual: one call writes both directions, so there is no
 * separate reverse call to make. Group membership is open by design: any user
 * may join any group, and there is no owner role.
 */
export function connect(userId: string): Promise<void> {
    return apiSend<void>('POST', `/me/connections/${userId}`);
}

export function disconnect(userId: string): Promise<void> {
    return apiSend<void>('DELETE', `/me/connections/${userId}`);
}

type Params = Record<string, string | number>;

export async function listAllGroups(
    params: Params,
): Promise<PagedList<ApiGroup>> {
    return pageOf(
        await apiGet<Paginated<ApiGroup>>(withQuery('/groups', params)),
    );
}

/**
 * EVERY group the caller belongs to, not one page.
 *
 * `GroupsPage` joins this against the paged public list to mark each row
 * joined-or-not. Paging this side too would render a membership living past
 * page 1 as an unremarkable "not joined", a false negative, and strictly
 * worse than the truncation notice it replaced. These are the caller's own
 * memberships, so the walk is bounded in practice and capped regardless.
 */
export function listMyGroupsAll(): Promise<{
    items: ApiGroup[];
    complete: boolean;
}> {
    return fetchAllPages(page =>
        apiGet<Paginated<ApiGroup>>(withQuery('/me/groups', { page })),
    );
}

/**
 * One group by id.
 *
 * Exists for name resolution: a rule may legitimately name a group the author
 * does not belong to ("anyone in the faculty group may have this"), and that
 * id appears in no membership list the caller holds.
 */
export function getGroup(groupId: string): Promise<ApiGroup> {
    return apiGet<ApiGroup>(`/groups/${groupId}`);
}

export function joinGroup(groupId: string): Promise<void> {
    return apiSend<void>('POST', `/me/groups/${groupId}`);
}

export function leaveGroup(groupId: string): Promise<void> {
    return apiSend<void>('DELETE', `/me/groups/${groupId}`);
}

/**
 * The two write shapes the backend actually accepts: `POST /groups` requires
 * both fields, `PATCH /groups/:id` takes either. Creating also joins the
 * caller: the backend does that, not this layer.
 */
export type GroupValues = { name: string; description: string };

export function createGroup(values: GroupValues): Promise<ApiGroup> {
    return apiSend<ApiGroup>('POST', '/groups', values);
}

export function updateGroup(
    groupId: string,
    values: Partial<GroupValues>,
): Promise<ApiGroup> {
    return apiSend<ApiGroup>('PATCH', `/groups/${groupId}`, values);
}

export function deleteGroup(groupId: string): Promise<void> {
    return apiSend<void>('DELETE', `/groups/${groupId}`);
}

export async function listUsers(params: Params): Promise<PagedList<ApiUser>> {
    return pageOf(
        await apiGet<Paginated<ApiUser>>(withQuery('/users', params)),
    );
}

/** Every connection, for the same join reason as `listMyGroupsAll`. */
export function listConnectionsAll(): Promise<{
    items: ApiUser[];
    complete: boolean;
}> {
    return fetchAllPages(page =>
        apiGet<Paginated<ApiUser>>(withQuery('/me/connections', { page })),
    );
}
