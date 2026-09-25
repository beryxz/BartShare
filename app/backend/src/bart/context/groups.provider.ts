import { Group, User } from '../../models/models';
import { BartAttrs } from '../types';
import { ContextProvider } from './provider';

/**
 * Each party's group memberships, as a collection of group ids. Enables
 * `condition: "<groupId>" in requester.groups`: "anyone in group G may have this".
 *
 * The example qualifies with `requester.` deliberately: unqualified `groups` resolves to the
 * policy owner's context, so `"<groupId>" in groups` asks whether *I* am in the group, which
 * does not depend on who is asking and so grants to everyone or to no one.
 */
export const groupsProvider: ContextProvider = {
    name: 'groups',
    keys: [
        {
            name: 'groups',
            description:
                'The ids of every group joined by the referenced user.',
            example: '"<groupId>" in requester.groups',
        },
    ],

    async contribute(partyIds: string[]): Promise<Map<string, BartAttrs>> {
        const users = await User.findAll({
            where: { id: partyIds },
            attributes: ['id'],
            include: [{ model: Group, attributes: ['id'] }],
        });

        const byId = new Map<string, BartAttrs>(
            partyIds.map(id => [id, { groups: [] }]),
        );
        for (const user of users) {
            const groups = user.Groups ?? [];
            byId.set(user.id, { groups: groups.map(g => g.id).sort() });
        }
        return byId;
    },
};
