import { providerKeys } from './context';
import {
    BART_KEYWORDS,
    isWritableNumber,
    NAME_RE,
    USER_ID_ATTR,
} from './emitter';

/** The two characters `STRING` needs escaped; control characters are checked separately. */
const BAD_VALUE_CHARS_RE = /["\\]/;

/** Below this, a character is an ASCII control character, which `STRING` cannot represent. */
const CONTROL_CHAR_BOUNDARY = 0x20;

function hasControlChar(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        if (value.charCodeAt(i) < CONTROL_CHAR_BOUNDARY) return true;
    }
    return false;
}

/**
 * Attribute names the system injects, and which user data therefore may not use. Derived from
 * the provider registry, so adding a context provider extends the blacklist.
 *
 * The resource side is what matters: attribute resolution searches the resource first for
 * every qualifier, so a resource named `(connections:…)` shadows the context for every party
 * and silently permits. Collisions between user-chosen names stay out of scope.
 */
export const RESERVED_ATTR_NAMES: ReadonlySet<string> = new Set([
    USER_ID_ATTR,
    ...providerKeys(),
]);

function scalarError(
    key: string,
    value: unknown,
    where: string,
): string | null {
    switch (typeof value) {
        case 'string':
            return BAD_VALUE_CHARS_RE.test(value) || hasControlChar(value)
                ? `attrs: ${where} of '${key}' may not contain '"', '\\' or control characters`
                : null;
        case 'number':
            if (isWritableNumber(value)) return null;
            if (!Number.isFinite(value))
                return `attrs: ${where} of '${key}' must be a finite number`;
            if (Number.isInteger(value))
                return (
                    `attrs: ${where} of '${key}' is outside the exact integer range ` +
                    `(got '${String(value)}'; whole numbers stop at ±(2^53 - 1))`
                );
            return (
                `attrs: ${where} of '${key}' must be a plain decimal number ` +
                `(got '${String(value)}'; Bart has no exponent notation)`
            );
        case 'boolean':
            return null;
        default:
            return `attrs: ${where} of '${key}' must be a string, number or boolean`;
    }
}

/**
 * Checks a free-form `attrs` object against what `.bart` can express.
 *
 * @returns one message per problem, empty when the object is fine. Every offending key is
 *          reported, so a caller fixes them in one round trip.
 */
export function validateAttrs(attrs: Record<string, unknown>): string[] {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(attrs)) {
        if (!NAME_RE.test(key)) {
            errors.push(
                `attrs: key '${key}' is not a valid Bart name ` +
                    `(letters, digits and underscore; may not start with a digit)`,
            );
            continue;
        }
        if (BART_KEYWORDS.has(key)) {
            errors.push(
                `attrs: key '${key}' is a reserved Bart keyword and cannot be an ` +
                    `attribute name`,
            );
            continue;
        }
        if (RESERVED_ATTR_NAMES.has(key)) {
            errors.push(
                `attrs: key '${key}' is reserved and is set by the system`,
            );
            continue;
        }

        if (Array.isArray(value)) {
            for (const element of value) {
                const error = scalarError(key, element, 'element');
                if (error !== null) {
                    errors.push(error);
                    break;
                }
            }
            continue;
        }

        const error = scalarError(key, value, 'value');
        if (error !== null) errors.push(error);
    }

    return errors;
}

/**
 * Checks a `from:` party pattern. Differs from {@link validateAttrs} in one way: `userId` is
 * allowed, since naming one party is what it exists for and it is the only unique attribute.
 * Context-provider keys stay rejected: they are context, not party attributes, so a pattern
 * using one matches nobody. An empty pattern is valid, `(any:)` meaning "any party at all".
 */
export function validatePartyPattern(attrs: Record<string, unknown>): string[] {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(attrs)) {
        if (!NAME_RE.test(key)) {
            errors.push(
                `from: key '${key}' is not a valid Bart name ` +
                    `(letters, digits and underscore; may not start with a digit)`,
            );
            continue;
        }
        if (BART_KEYWORDS.has(key)) {
            errors.push(
                `from: key '${key}' is a reserved Bart keyword and cannot be ` +
                    `an attribute name`,
            );
            continue;
        }
        if (key !== USER_ID_ATTR && RESERVED_ATTR_NAMES.has(key)) {
            errors.push(
                `from: key '${key}' is context, not a party attribute, and ` +
                    `would match no one`,
            );
            continue;
        }

        if (Array.isArray(value)) {
            for (const element of value) {
                const error = scalarError(key, element, 'element');
                if (error !== null) {
                    errors.push(error.replace(/^attrs: /, 'from: '));
                    break;
                }
            }
            continue;
        }

        const error = scalarError(key, value, 'value');
        if (error !== null) errors.push(error.replace(/^attrs: /, 'from: '));
    }

    return errors;
}
