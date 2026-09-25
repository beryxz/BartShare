import { FastifyInstance } from 'fastify';
import {
    Attributes,
    literal,
    Model,
    Op,
    OrderItem,
    WhereAttributeHashValue,
} from 'sequelize';
import { PaginatedResults } from './schemas.utils';

export function whereSubstring<
    M extends Model,
    TAttributes = Attributes<M>,
    AttributeName extends string & keyof TAttributes =
        keyof TAttributes extends string ? keyof TAttributes : never,
>(
    fastify: FastifyInstance,
    attr: AttributeName,
    value: string | undefined,
): {
    [attr: string]: WhereAttributeHashValue<TAttributes[AttributeName]>;
} {
    const isPg: boolean = fastify.db.getDialect() === 'postgres';

    return value
        ? {
              [attr]: {
                  [isPg ? Op.iLike : Op.substring]: isPg ? `%${value}%` : value,
              },
          }
        : {};
}

/**
 * Substring match against a path INSIDE a JSON column.
 *
 * Sequelize reads a dotted key as a JSON path on JSON/JSONB, so
 * `'metadata.name'` becomes `metadata#>>'{name}'`, text comparable with
 * iLike. Same Postgres-only iLike branch as `whereSubstring`.
 */
export function whereJsonSubstring(
    fastify: FastifyInstance,
    path: string,
    value: string | undefined,
): Record<string, unknown> {
    if (!value) return {};
    const isPg: boolean = fastify.db.getDialect() === 'postgres';
    return {
        [path]: {
            [isPg ? Op.iLike : Op.substring]: isPg ? `%${value}%` : value,
        },
    };
}

/**
 * Parses a raw query value into the JSON type it denotes, or undefined when it
 * is only ever a string. Query params carry no type, but jsonb containment is
 * type-strict, so `year=2023` must probe the number 2023 as well as "2023".
 */
function typedProbe(value: string): number | boolean | undefined {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value.trim() === '') return undefined;
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : undefined;
}

export type AttrProbeSet = { key: string; probes: unknown[] };

/**
 * Parses `attr=key:value` into a jsonb containment probe set: both the
 * scalar and array form (see `typedProbe` for the numeric/boolean forms).
 * `null` means malformed (caller should match nothing); `undefined` means
 * no filter at all.
 */
export function attrProbes(
    raw: string | undefined,
): AttrProbeSet | null | undefined {
    if (!raw) return undefined;

    const split = raw.indexOf(':');
    if (split <= 0) return null;

    const key = raw.slice(0, split);
    const value = raw.slice(split + 1);

    const probes: unknown[] = [value, [value]];
    const typed = typedProbe(value);
    if (typed !== undefined) probes.push(typed, [typed]);

    return { key, probes };
}

/**
 * `attr=key:value` as a jsonb containment predicate, for a Sequelize `where`.
 * See `attrProbes` for the probe set and the malformed-value contract.
 */
export function whereAttrContains(
    column: string,
    raw: string | undefined,
): Record<string | symbol, unknown> {
    const parsed = attrProbes(raw);
    if (parsed === undefined) return {};
    if (parsed === null) return { [Op.and]: [literal('1=0')] };

    return {
        [Op.or]: parsed.probes.map(probe => ({
            [column]: { [Op.contains]: { [parsed.key]: probe } },
        })),
    };
}

/**
 * `page` is an object, not two more positional args: `(rows, count, pageNum,
 * pageSize)` type-checks in the wrong order too and silently yields a wrong
 * `totalPages`/`page.number`. Naming them makes that swap unspellable.
 */
export function returnPaginatedResults<Item>(
    data: Item[],
    totalCount: number,
    page: { size: number; number: number },
): PaginatedResults<Item> {
    return {
        data: data,
        page: {
            size: page.size,
            totalElements: totalCount,
            totalPages: Math.ceil(totalCount / page.size),
            number: page.number,
        },
    };
}

export function orderWithFilter(order: (OrderItem | undefined)[]): OrderItem[] {
    return order.filter<OrderItem>(item => item !== undefined);
}
