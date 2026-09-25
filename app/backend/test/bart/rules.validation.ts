'use strict';

import t from 'tap';
import { validateUserRules } from '../../src/bart/rules.validation';
import { withFakeEvaluator } from '../support/fake-evaluator';

t.test('a party with no rules is still validated', async t => {
    t.plan(2);
    // The party's own attributes are half the policy: `(party:(userId:"…")(k:…),
    // rules:())` can fail to parse even with no rules at all.
    const seen: string[] = [];
    const errors = await withFakeEvaluator(
        body => {
            seen.push(body);
            return { valid: true };
        },
        () =>
            validateUserRules({
                id: 'u1',
                attrs: { username: 'u' },
                rules: [],
            }),
    );

    t.equal(seen.length, 1, 'the assembled policy reached the evaluator');
    t.same(errors, []);
});

t.test('a valid assembled policy returns no errors', async t => {
    t.plan(1);
    await withFakeEvaluator(
        () => ({ valid: true }),
        async () => {
            const errors = await validateUserRules({
                id: 'u1',
                attrs: {},
                rules: ['(resource:(type:"notes"))'],
            });
            t.same(errors, [], 'no errors');
        },
    );
});

t.test(
    'formats the line and column when the evaluator reports one',
    async t => {
        t.plan(1);
        await withFakeEvaluator(
            () => ({
                valid: false,
                error: { line: 3, column: 9, message: 'boom' },
            }),
            async () => {
                const errors = await validateUserRules({
                    id: 'u1',
                    attrs: {},
                    rules: ['(resource:(type:"notes"))'],
                });
                t.same(errors, ['rules: line 3:9 boom'], 'position included');
            },
        );
    },
);

t.test('omits the position when the evaluator does not report one', async t => {
    t.plan(1);
    await withFakeEvaluator(
        () => ({
            valid: false,
            error: { line: null, column: null, message: 'boom' },
        }),
        async () => {
            const errors = await validateUserRules({
                id: 'u1',
                attrs: {},
                rules: ['(resource:(type:"notes"))'],
            });
            t.same(errors, ['rules: boom'], 'no position prefix');
        },
    );
});

t.test(
    'falls back to a generic message when the evaluator reports invalid without an error',
    async t => {
        t.plan(1);
        await withFakeEvaluator(
            () => ({ valid: false }),
            async () => {
                const errors = await validateUserRules({
                    id: 'u1',
                    attrs: {},
                    rules: ['(resource:(type:"notes"))'],
                });
                t.same(
                    errors,
                    ['rules: the assembled policy is not valid'],
                    'generic message',
                );
            },
        );
    },
);
