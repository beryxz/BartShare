import { BartAttrs } from '../../bart/types';

/**
 * A party in a canned scenario.
 *
 * `key` is a local alias (`'john'`), resolved to a generated UUID when
 * seeded. This works only because these scenarios' rules never mention a
 * literal party id; a fixture that needed one would have to extend this type.
 * A group id is the one id a rule may name, and {@link ScenarioGroup} carries
 * it literally for exactly that reason.
 *
 * `rules` holds the text the app displays verbatim, so each entry is written
 * in the canonical printed form and its continuation lines start at column 0:
 * a template literal keeps every character, indentation included.
 */
export type ScenarioUser = {
    key: string;
    attrs: BartAttrs;
    rules: string[];
};

/**
 * A resource in a canned scenario.
 *
 * `attrs` is the Bart request and holds policy vocabulary only; `metadata`
 * is display data, never validated as Bart or emitted into a policy.
 *
 * `content` is optional filler so the download path is reachable in a seeded
 * demo; without it a permit offers nothing to fetch. Nothing reads the bytes.
 */
export type ScenarioResource = {
    key: string;
    ownerKey: string;
    attrs: BartAttrs;
    metadata: Record<string, unknown> & { name: string };
    content?: { text: string; filename: string };
};

/**
 * A group in a canned scenario.
 *
 * `id` is written out rather than generated, unlike every other key here: a
 * condition names the group id verbatim, so the id has to exist before the
 * rule text that quotes it does. Seeding requires an empty database, so a
 * fixed id has nothing to collide with.
 */
export type ScenarioGroup = {
    id: string;
    name: string;
    description: string;
    memberKeys: string[];
};

export type ScenarioCounts = {
    users: number;
    resources: number;
    connections: number;
    groups: number;
};

export type Scenario = {
    id: string;
    title: string;
    summary: string;
    users: ScenarioUser[];
    resources: ScenarioResource[];
    /** Pairs of user keys. Written in both directions, since app connections are mutual. */
    connections: [string, string][];
    groups?: ScenarioGroup[];
};
