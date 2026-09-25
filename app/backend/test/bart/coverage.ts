'use strict';

import t from 'tap';
import { nearestGap, CoverageResource } from '../../src/bart/coverage';

function resource(
    id: string,
    name: string,
    attrs: CoverageResource['attrs'],
): CoverageResource {
    return { id, name, attrs };
}

t.test('overlap outranks agreeing/blocking -- the typo scenario', async t => {
    t.plan(4);

    // Both tie at agreeing=0: calculus (blocking=4, overlap=1) vs stray
    // (blocking=1, overlap=0). Overlap correctly picks calculus, the one
    // actually mistyped; a blocking-first ranking would pick stray instead.
    const calculus = resource('calc-1', 'Calculus exercises', {
        type: 'exercises',
        course: 'calculus',
        teacher: 'brown',
        year: '2024',
    });
    const stray = resource('stray-1', 'Misc', { kind: 'misc' });

    const gap = nearestGap([calculus, stray], { teacher: 'green' });

    t.equal(gap?.name, 'Calculus exercises', 'the disagreeing resource wins');
    t.same(gap?.conflicting, ['teacher'], 'names the mistyped attribute');
    t.same(
        gap?.missing,
        ['type', 'course', 'year'],
        'every other key is unmentioned by this sparse pattern',
    );
    t.not(gap?.name, 'Misc', 'the old ranking would have named the stray');
});

t.test('overlap ties: agreeing decides', async t => {
    t.plan(2);

    const pattern = { a: '1', b: '2', c: '3' };

    // agreeing=2 (a, b), conflicting=[c], missing=[d] -> overlap = 2 + 1 = 3
    const lessAgreeing = resource('r-2', 'Less agreeing', {
        a: '1',
        b: '2',
        c: '9',
        d: 'x',
    });
    // agreeing=3 (a, b, c), conflicting=[], missing=[e] -> overlap = 3 + 0 = 3
    const moreAgreeing = resource('r-1', 'More agreeing', {
        a: '1',
        b: '2',
        c: '3',
        e: 'y',
    });

    const gap = nearestGap([lessAgreeing, moreAgreeing], pattern);

    t.equal(
        gap?.name,
        'More agreeing',
        'same overlap (3) -- more attributes actually agreed on wins',
    );
    t.same(
        gap?.missing,
        ['e'],
        "reports the winner's own gap, not the loser's",
    );
});

t.test('overlap, agreeing, blocking all tie: id ascending decides', async t => {
    t.plan(1);

    const pattern = { a: '1' };

    // Both: agreeing=1 (a), conflicting=[], missing=[one other key] ->
    // overlap=1, blocking=1 for each. Only the id differs.
    const higherId = resource('r-2', 'Second', { a: '1', z: 'q' });
    const lowerId = resource('r-1', 'First', { a: '1', w: 'q' });

    const gap = nearestGap([higherId, lowerId], pattern);

    t.equal(
        gap?.name,
        'First',
        'the lexicographically smaller id wins the tie',
    );
});

t.test('a covered resource is skipped', async t => {
    t.plan(2);

    const pattern = { kind: 'notes' };
    const covered = resource('r-1', 'Covered', { kind: 'notes' });
    const uncovered = resource('r-2', 'Uncovered', { kind: 'slides' });

    t.equal(
        nearestGap([covered], pattern),
        null,
        'the only resource is covered, so there is nothing to explain',
    );

    const gap = nearestGap([covered, uncovered], pattern);
    t.equal(
        gap?.name,
        'Uncovered',
        'the covered resource never competes for nearest',
    );
});
