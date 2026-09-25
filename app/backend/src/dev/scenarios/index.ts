import { ex1 } from './ex1';
import { ex2 } from './ex2';
import { ex3 } from './ex3';
import { ex4 } from './ex4';
import { ex5 } from './ex5';
import { Scenario, ScenarioCounts } from './types';

export * from './types';

/**
 * The catalogue, in the order the picker shows it: the paper-derived
 * scenarios first, in increasing order of what they demonstrate, then the
 * ones exercising app features the printed examples never touch.
 *
 * Adding another is one new file plus one line here; the HTTP contract
 * doesn't change, since `GET /dev/scenarios` serves this array.
 */
export const SCENARIOS: readonly Scenario[] = [ex1, ex2, ex3, ex4, ex5];

export function scenarioById(id: string): Scenario | undefined {
    return SCENARIOS.find(scenario => scenario.id === id);
}

/**
 * What a scenario will create, derived from the fixture and never from the
 * database. The picker shows these before seeding, which is the point: the
 * operator sees the size of what they are about to load.
 */
export function countsOf(scenario: Scenario): ScenarioCounts {
    return {
        users: scenario.users.length,
        resources: scenario.resources.length,
        connections: scenario.connections.length,
        groups: scenario.groups?.length ?? 0,
    };
}
