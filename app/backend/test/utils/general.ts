'use strict';

import { ValidationError, ValidationErrorItem } from 'sequelize';
import t from 'tap';
import config from '../../src/config';
import {
    debug,
    formatValidationError,
    isDateValid,
    log,
    mapWithConcurrency,
    now,
    randomAlphanumericString,
    sleep,
} from '../../src/utils/general.utils';

/**
 * Runs `fn` with the given config flags applied, restoring them afterwards.
 * The config object is a module singleton shared with the code under test.
 */
function withConfig(
    flags: { DEBUG: boolean; LOGGING: boolean },
    fn: () => void,
) {
    const previous = { DEBUG: config.DEBUG, LOGGING: config.LOGGING };
    Object.assign(config, flags);
    try {
        fn();
    } finally {
        Object.assign(config, previous);
    }
}

function captureLogs(fn: () => void): string[] {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
        lines.push(args.join(' '));
    };
    try {
        fn();
    } finally {
        console.log = original;
    }
    return lines;
}

t.test('formatValidationError extracts the item messages', async t => {
    t.plan(1);

    // only the message is read back out, so the items are stubbed: the
    // ValidationErrorItem constructor wants a full validator context
    const error = new ValidationError('invalid', [
        { message: 'first is invalid' } as ValidationErrorItem,
        { message: 'second is invalid' } as ValidationErrorItem,
    ]);

    t.same(formatValidationError(error), [
        'first is invalid',
        'second is invalid',
    ]);
});

t.test('now returns an ISO 8601 timestamp', async t => {
    t.plan(1);

    t.match(now(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

t.test('log writes only when LOGGING is enabled', async t => {
    t.plan(3);

    withConfig({ DEBUG: false, LOGGING: false }, () => {
        t.same(
            captureLogs(() => log('hidden')),
            [],
            'silent when disabled',
        );
    });

    withConfig({ DEBUG: false, LOGGING: true }, () => {
        const lines = captureLogs(() => log('shown'));
        t.equal(lines.length, 1, 'one line when enabled');
        t.match(lines[0], /^\[.+\]: shown$/, 'line is timestamped');
    });
});

t.test('debug writes only when DEBUG and LOGGING are enabled', async t => {
    t.plan(4);

    withConfig({ DEBUG: false, LOGGING: false }, () => {
        t.same(
            captureLogs(() => debug('hidden')),
            [],
            'both disabled',
        );
    });
    withConfig({ DEBUG: true, LOGGING: false }, () => {
        t.same(
            captureLogs(() => debug('hidden')),
            [],
            'logging disabled',
        );
    });
    withConfig({ DEBUG: false, LOGGING: true }, () => {
        t.same(
            captureLogs(() => debug('hidden')),
            [],
            'debug disabled',
        );
    });
    withConfig({ DEBUG: true, LOGGING: true }, () => {
        t.equal(captureLogs(() => debug('shown')).length, 1, 'both enabled');
    });
});

t.test('isDateValid recognizes parseable dates', async t => {
    t.plan(4);

    t.ok(isDateValid('2026-07-28T10:00:00.000Z'), 'ISO 8601');
    t.ok(isDateValid('2026-07-28'), 'date only');
    t.notOk(isDateValid('not-a-date'), 'unparseable string');
    t.notOk(isDateValid(''), 'empty string');
});

t.test('sleep resolves after the given delay', async t => {
    t.plan(1);

    const start = Date.now();
    await sleep(20);
    t.ok(Date.now() - start >= 15, 'waited for about the requested time');
});

t.test('randomAlphanumericString', async t => {
    t.plan(4);

    const value = randomAlphanumericString(32);
    t.equal(value.length, 32, 'has the requested length');
    t.match(value, /^[a-z0-9]{32}$/, 'uses the alphanumeric charset');

    t.throws(
        () => randomAlphanumericString(0),
        /invalid length/,
        'rejects lengths below 1',
    );
    t.throws(
        () => randomAlphanumericString(2 ** 30 + 1),
        /invalid length/,
        'rejects lengths above the cap',
    );
});

t.test('mapWithConcurrency preserves order and caps parallelism', async t => {
    t.plan(2);

    let running = 0;
    let peak = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async n => {
        running += 1;
        peak = Math.max(peak, running);
        await sleep(5);
        running -= 1;
        return n * 2;
    });

    t.same(results, [2, 4, 6, 8, 10], 'results follow input order');
    t.ok(peak <= 2, `at most 2 ran at once (peak ${peak})`);
});
