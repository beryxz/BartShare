import { randomInt } from 'crypto';
import { ValidationError } from 'sequelize';
import config from '../config';

function formatValidationError(error: ValidationError): string[] {
    return error.errors.map(error => error.message);
}

function log(msg: string | object) {
    if (!config.LOGGING) return;
    console.log(`[${now()}]: ${msg}`);
}
function debug(msg: string | object) {
    if (!config.DEBUG || !config.LOGGING) return;
    console.log(`[${now()}]: ${msg}`);
}

function now() {
    return new Date().toISOString();
}

function isDateValid(date: string) {
    const dateObj = new Date(date);
    return date && dateObj instanceof Date && !isNaN(dateObj.getTime());
}

async function sleep(ms: number): Promise<void> {
    return new Promise((res, _) => setTimeout(res, ms));
}

const CHARSET_ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomAlphanumericString(length: number): string {
    if (length < 1 || length > 2 ** 30) {
        throw new Error('invalid length for random string');
    }
    return Array.from(new Array(length))
        .map(_ => CHARSET_ALPHANUM[randomInt(0, CHARSET_ALPHANUM.length)])
        .join('');
}

/**
 * Maps over `items` with at most `limit` calls in flight, preserving order.
 *
 * The middle ground between `Promise.all` (all at once) and a serial loop:
 * workers pull from a shared cursor until the list is exhausted.
 */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
        for (;;) {
            const i = cursor++;
            if (i >= items.length) return;
            results[i] = await fn(items[i]);
        }
    };

    await Promise.all(
        Array.from(
            { length: Math.max(1, Math.min(limit, items.length)) },
            worker,
        ),
    );
    return results;
}

export {
    debug,
    formatValidationError,
    isDateValid,
    log,
    mapWithConcurrency,
    now,
    randomAlphanumericString,
    sleep,
};
