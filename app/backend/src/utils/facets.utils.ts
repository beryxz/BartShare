import { FastifyInstance } from 'fastify';
import { QueryTypes } from 'sequelize';
import { RESERVED_ATTR_NAMES } from '../bart/reserved';
import { attrProbes } from './controllers.utils';

export type Facet = { key: string; values: string[] };

export type ResourceFacetFilter = {
    name?: string;
    attr?: string;
    ownerId?: string; // /me/resources/facets: restrict to this owner
    excludeUserId?: string; // /resources/facets: exclude this owner's rows
};

/**
 * `attr=key:value` as a raw-SQL jsonb containment clause. See `attrProbes`
 * for the probe set and the malformed-value contract.
 *
 * Every probe is a bound replacement, never interpolated into the SQL text:
 * both facet endpoints are public and unauthenticated.
 */
function attrContainsSql(
    raw: string | undefined,
    replacements: Record<string, unknown>,
    prefix = 'attrProbe',
): string | null {
    const parsed = attrProbes(raw);
    if (parsed === undefined) return null;
    if (parsed === null) return 'FALSE';

    const clauses = parsed.probes.map((probe, i) => {
        const name = `${prefix}${i}`;
        replacements[name] = JSON.stringify({ [parsed.key]: probe });
        return `r.attrs @> :${name}::jsonb`;
    });
    return `(${clauses.join(' OR ')})`;
}

/**
 * Builds the WHERE clause and bound replacements for `facetsOfResources`:
 * every user-derived value is written into `replacements` and referenced
 * from the SQL text only as `:placeholder`, never concatenated in.
 */
function buildFacetWhere(filter: ResourceFacetFilter): {
    whereSql: string;
    replacements: Record<string, unknown>;
} {
    const clauses: string[] = ['TRUE'];
    const replacements: Record<string, unknown> = {};

    if (filter.name) {
        clauses.push(`r.metadata #>> '{name}' ILIKE :name`);
        replacements.name = `%${filter.name}%`;
    }
    if (filter.ownerId !== undefined) {
        clauses.push(`r."UserId" = :ownerId`);
        replacements.ownerId = filter.ownerId;
    }
    if (filter.excludeUserId) {
        clauses.push(`r."UserId" <> :excludeUserId`);
        replacements.excludeUserId = filter.excludeUserId;
    }
    const attrClause = attrContainsSql(filter.attr, replacements);
    if (attrClause !== null) clauses.push(attrClause);

    return { whereSql: clauses.join(' AND '), replacements };
}

/**
 * The two tables carrying a jsonb `attrs` column.
 *
 * A closed union, never a caller-supplied string: the table name is the one
 * fragment that can't travel as a bound replacement, so the type is what
 * keeps user-derived data out of the SQL text.
 */
type FacetTable = 'Resources' | 'Users';

/**
 * The distinct attribute vocabulary over one table, given a prebuilt WHERE.
 *
 * The array/scalar guard lives inside the joined function's own `CASE`
 * argument, never the join's `ON`, which still runs before any predicate
 * and would throw on a scalar row.
 */
async function facetRows(
    fastify: FastifyInstance,
    table: FacetTable,
    whereSql: string,
    replacements: Record<string, unknown>,
): Promise<Facet[]> {
    const rows = await fastify.db.query<{ key: string; value: string }>(
        `SELECT DISTINCT kv.key AS key,
                COALESCE(elem, kv.value #>> '{}') AS value
           FROM "${table}" r
           CROSS JOIN LATERAL jsonb_each(r.attrs) kv
           LEFT JOIN LATERAL jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(kv.value) = 'array'
                       THEN kv.value END
                  ) elem ON true
          WHERE ${whereSql}
          ORDER BY key, value`,
        { type: QueryTypes.SELECT, replacements },
    );

    const byKey = new Map<string, string[]>();
    for (const row of rows) {
        if (RESERVED_ATTR_NAMES.has(row.key)) continue;
        if (row.value === null) continue;
        const values = byKey.get(row.key) ?? [];
        values.push(row.value);
        byKey.set(row.key, values);
    }

    return [...byKey.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, values]) => ({ key, values }));
}

/**
 * The distinct attribute vocabulary across a set of resources.
 *
 * Chips describe the corpus, not the page in hand: deriving them
 * client-side would offer a vocabulary that contradicts the results.
 */
export async function facetsOfResources(
    fastify: FastifyInstance,
    filter: ResourceFacetFilter,
): Promise<Facet[]> {
    const { whereSql, replacements } = buildFacetWhere(filter);
    return facetRows(fastify, 'Resources', whereSql, replacements);
}

export type UserFacetFilter = {
    /** Substring match against `attrs.username`, mirroring `GET /users`. */
    username?: string;
};

/**
 * The distinct attribute vocabulary across parties.
 *
 * `RESERVED_ATTR_NAMES` (in `facetRows`) keeps `userId` out even though it's
 * legal in a party pattern: a list of uuids isn't a useful suggestion.
 */
export async function facetsOfUsers(
    fastify: FastifyInstance,
    filter: UserFacetFilter,
): Promise<Facet[]> {
    const clauses: string[] = ['TRUE'];
    const replacements: Record<string, unknown> = {};

    if (filter.username) {
        clauses.push(`r.attrs #>> '{username}' ILIKE :username`);
        replacements.username = `%${filter.username}%`;
    }

    return facetRows(fastify, 'Users', clauses.join(' AND '), replacements);
}
