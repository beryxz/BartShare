import { emitPolicy } from './emitter';
import { validatePolicy } from './evaluator.client';
import { BartAttrs } from './types';

/**
 * Checks a user's rules by validating the policy they will become. Rules come from the
 * frontend and are untrusted; unparseable text in the database breaks the closure and the
 * evaluation of an unrelated user later. `policyFile` is the smallest unit the grammar
 * offers, so the whole assembled policy is validated, a party with no rules included: its
 * own attributes are half the policy and can fail to parse on their own.
 *
 * @returns one message per problem, empty when the rules are fine
 */
export async function validateUserRules(user: {
    id: string;
    attrs: BartAttrs;
    rules: string[];
}): Promise<string[]> {
    const outcome = await validatePolicy(emitPolicy(user));
    if (outcome.valid) return [];

    const error = outcome.error;
    if (error === undefined)
        return ['rules: the assembled policy is not valid'];

    const position =
        error.line !== null && error.column !== null
            ? `line ${error.line}:${error.column} `
            : '';
    return [`rules: ${position}${error.message}`];
}
