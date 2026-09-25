import { User } from '../../models/models';
import { BartAttrs } from '../types';
import { ContextProvider } from './provider';

/**
 * Each party's connections, as a collection of user ids. Makes
 * `condition: requester.userId in connections` work: unqualified `connections` resolves to the
 * policy owner's context, `requester.userId` to the requester's party attributes.
 */
export const connectionsProvider: ContextProvider = {
    name: 'connections',
    keys: [
        {
            name: 'connections',
            description:
                'The ids of everyone you are connected to. Connections are mutual.',
            example: 'requester.userId in connections',
        },
    ],

    async contribute(partyIds: string[]): Promise<Map<string, BartAttrs>> {
        const users = await User.findAll({
            where: { id: partyIds },
            attributes: ['id'],
            include: [{ model: User, as: 'Connections', attributes: ['id'] }],
        });

        // Every party gets an entry, empty collection included: an absent name is an
        // UndefinedName at evaluation time, which denies the rule.
        const byId = new Map<string, BartAttrs>(
            partyIds.map(id => [id, { connections: [] }]),
        );
        for (const user of users) {
            const connections = user.Connections ?? [];
            byId.set(user.id, {
                connections: connections.map(c => c.id).sort(),
            });
        }
        return byId;
    },
};
