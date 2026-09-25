import { BartAttrs } from '../types';
import { ContextProvider, EvalContext } from './provider';

/** Keys use underscores: `date.year` would not lex, and `.` is the qualifier operator. */
export const dateProvider: ContextProvider = {
    name: 'date',
    keys: [
        {
            name: 'date_year',
            description: 'The UTC year at evaluation time.',
            example: 'date_year > 2025',
        },
        {
            name: 'date_month',
            description: 'The UTC month at evaluation time, 1-12.',
            example: 'date_month = 12',
        },
        {
            name: 'date_day',
            description: 'The UTC day of the month at evaluation time.',
            example: 'date_day <= 15',
        },
    ],

    async contribute(
        partyIds: string[],
        evalCtx: EvalContext,
    ): Promise<Map<string, BartAttrs>> {
        // One instant for every party, so a rule cannot see two different "todays".
        const attrs: BartAttrs = {
            date_year: evalCtx.now.getUTCFullYear(),
            date_month: evalCtx.now.getUTCMonth() + 1,
            date_day: evalCtx.now.getUTCDate(),
        };
        return new Map(partyIds.map(id => [id, { ...attrs }]));
    },
};
