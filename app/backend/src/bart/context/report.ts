import { Group, User } from '../../models/models';
import { BartAttrs } from '../types';
import { CONTEXT_PROVIDERS, mergeContributions } from './index';

export type ContextName = {
    key: string;
    providedBy: string;
    description: string;
    example: string;
};

export type ContextReport = {
    values: BartAttrs;
    display: {
        connections: { id: string; username: string }[];
        groups: { id: string; name: string }[];
    };
    names: ContextName[];
};

/**
 * A real guard, not dead code: `values` is keyed by name, so this degrades to
 * "no ids" if a provider is ever renamed or dropped from the registry.
 */
function asIds(value: unknown): string[] {
    return Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
}

/**
 * What the engine will see for one party, plus the vocabulary to write rules against it.
 *
 * `values` is exactly what the providers emit: the ids a condition matches on. `display`
 * resolves those ids for humans, without pretending the policy sees a username. `names`
 * derives from the provider registry, so adding a provider extends the reference.
 */
export async function buildContextReport(
    userId: string,
): Promise<ContextReport> {
    // One instant for every provider, the same contract `buildContextTuple` gives them.
    const now = new Date();
    const contributions = await Promise.all(
        CONTEXT_PROVIDERS.map(provider =>
            provider.contribute([userId], { now }),
        ),
    );

    const values = mergeContributions(userId, contributions, CONTEXT_PROVIDERS);

    const connectionIds = asIds(values.connections);
    const groupIds = asIds(values.groups);

    const [connectionRows, groupRows] = await Promise.all([
        User.findAll({
            where: { id: connectionIds },
            attributes: ['id', 'attrs'],
        }),
        Group.findAll({ where: { id: groupIds }, attributes: ['id', 'name'] }),
    ]);

    const names: ContextName[] = CONTEXT_PROVIDERS.flatMap(provider =>
        provider.keys.map(key => ({
            key: key.name,
            providedBy: provider.name,
            description: key.description,
            example: key.example,
        })),
    );

    return {
        values,
        display: {
            // No `?? row.id` fallback: `User.attrs.username` is validated as a required,
            // non-empty, trimmed, unique string on every write.
            connections: connectionRows.map(row => ({
                id: row.id,
                username: String(row.attrs.username),
            })),
            groups: groupRows.map(row => ({ id: row.id, name: row.name })),
        },
        names,
    };
}
