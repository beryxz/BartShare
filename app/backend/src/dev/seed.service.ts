import { Sequelize, Transaction } from 'sequelize';
import { validateAttrs } from '../bart/reserved';
import { validateUserRules } from '../bart/rules.validation';
import { BartAttrs } from '../bart/types';
import { Group, LogEvent, Resource, User } from '../models/models';
import { countsOf, SCENARIOS, Scenario, ScenarioCounts } from './scenarios';

/**
 * A fixture that does not survive its own validation. This is a bug in the
 * repository, not something a caller did wrong, so the controller answers 500
 * and never 400: no request body could have avoided it.
 */
export class FixtureInvalidError extends Error {
    readonly errors: string[];

    constructor(errors: string[]) {
        super(errors[0] ?? 'the scenario fixture is not valid');
        this.name = 'FixtureInvalidError';
        this.errors = errors;
    }
}

/**
 * The party id used while validating a fixture, before any row exists.
 *
 * Same reasoning as the placeholder in `users.controller.create_new`: only
 * `userId`'s presence matters for the parse, so a fixed zero UUID validates
 * exactly what the real id would.
 */
const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000';

export function listScenarios(): {
    id: string;
    title: string;
    summary: string;
    counts: ScenarioCounts;
}[] {
    return SCENARIOS.map(scenario => ({
        id: scenario.id,
        title: scenario.title,
        summary: scenario.summary,
        counts: countsOf(scenario),
    }));
}

/**
 * Whether the database holds nothing a scenario could collide with.
 *
 * `Group` is the one table that can hold rows with no users at all, so a
 * user-count check alone would miss leftover groups and produce a policy
 * system nobody described.
 */
export async function isDatabaseEmpty(): Promise<boolean> {
    const [users, groups] = await Promise.all([User.count(), Group.count()]);
    return users === 0 && groups === 0;
}

/**
 * Validates every party, exactly as `POST /users` validates one.
 *
 * Runs outside any transaction: this reaches the evaluator over HTTP, so an
 * outage leaves the database untouched, with no rollback needed.
 *
 * @throws FixtureInvalidError, or `validateUserRules`'s error for an
 *         unreachable evaluator (map with `mapEvaluatorError`)
 */
async function validateFixture(scenario: Scenario): Promise<void> {
    const errors: string[] = [];

    for (const user of scenario.users) {
        errors.push(
            ...validateAttrs(user.attrs).map(
                message => `${scenario.id}/${user.key}: ${message}`,
            ),
        );
    }
    for (const resource of scenario.resources) {
        errors.push(
            ...validateAttrs(resource.attrs).map(
                message => `${scenario.id}/${resource.key}: ${message}`,
            ),
        );
    }
    if (errors.length > 0) throw new FixtureInvalidError(errors);

    // Sequential rather than parallel: a serial loop keeps the failure
    // attributable to one party.
    for (const user of scenario.users) {
        const ruleErrors = await validateUserRules({
            id: PLACEHOLDER_ID,
            attrs: user.attrs as BartAttrs,
            rules: user.rules,
        });
        if (ruleErrors.length > 0)
            throw new FixtureInvalidError(
                ruleErrors.map(
                    message => `${scenario.id}/${user.key}: ${message}`,
                ),
            );
    }
}

async function writeFixture(
    scenario: Scenario,
    transaction: Transaction,
): Promise<void> {
    const idByKey = new Map<string, string>();

    for (const user of scenario.users) {
        const row = await User.create(
            { attrs: user.attrs, rules: user.rules },
            { transaction },
        );
        idByKey.set(user.key, row.id);
    }

    for (const resource of scenario.resources) {
        // The other three content columns are what `GET /resources/:id/content`
        // answers with: bytes alone download as an unnamed binary blob.
        const bytes = resource.content
            ? Buffer.from(resource.content.text, 'utf8')
            : null;
        await Resource.create(
            {
                attrs: resource.attrs,
                metadata: resource.metadata,
                UserId: idByKey.get(resource.ownerKey),
                content: bytes,
                contentType: bytes ? 'text/plain' : null,
                contentSize: bytes ? bytes.byteLength : null,
                contentFilename: resource.content?.filename ?? null,
            },
            { transaction },
        );
    }

    for (const [leftKey, rightKey] of scenario.connections) {
        const [left, right] = await Promise.all([
            User.findByPk(idByKey.get(leftKey), { transaction }),
            User.findByPk(idByKey.get(rightKey), { transaction }),
        ]);
        // Both directions, matching `post_connection`: connections are
        // mutual, and the context provider reads only the owning side.
        await left!.addConnection(right!, { transaction });
        await right!.addConnection(left!, { transaction });
    }

    for (const group of scenario.groups ?? []) {
        // The id comes from the fixture rather than the column default: rules
        // quote it, so it has to be known before the text that names it.
        const row = await Group.create(
            { id: group.id, name: group.name, description: group.description },
            { transaction },
        );
        for (const memberKey of group.memberKeys) {
            const member = await User.findByPk(idByKey.get(memberKey), {
                transaction,
            });
            await member!.addGroup(row, { transaction });
        }
    }
}

/**
 * Loads a scenario into an empty database. The caller must check
 * `isDatabaseEmpty()` first; that check and its 409 are an HTTP concern.
 *
 * Validated before the transaction opens, so a failure halfway leaves an
 * empty database, not half a scenario.
 */
export async function seedScenario(
    sequelize: Sequelize,
    scenario: Scenario,
): Promise<ScenarioCounts> {
    await validateFixture(scenario);
    await sequelize.transaction(transaction =>
        writeFixture(scenario, transaction),
    );
    return countsOf(scenario);
}

export type ResetCounts = {
    users: number;
    resources: number;
    groups: number;
    logEvents: number;
};

/**
 * Wipes every table this app owns and reports what was there.
 *
 * Model-level `truncate`, not raw SQL, keeps the statement schema-qualified.
 * `cascade` reaches everything with a foreign key into `Users`; `Groups`
 * truncates separately since nothing references it.
 */
export async function resetDatabase(
    sequelize: Sequelize,
): Promise<ResetCounts> {
    return sequelize.transaction(async transaction => {
        const [users, resources, groups, logEvents] = await Promise.all([
            User.count({ transaction }),
            Resource.count({ transaction }),
            Group.count({ transaction }),
            LogEvent.count({ transaction }),
        ]);

        await User.truncate({ cascade: true, transaction });
        await Group.truncate({ cascade: true, transaction });

        return { users, resources, groups, logEvents };
    });
}
