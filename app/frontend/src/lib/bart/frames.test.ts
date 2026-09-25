import { describe, expect, it } from 'vitest';
import { DiagramStep } from './diagram';
import { nest, terms } from './frames';

const request: DiagramStep = {
    kind: 'request',
    level: 0,
    from: 1,
    to: 2,
    resource: { type: 'lectureNotes' },
    outcome: true,
};

const open: DiagramStep = {
    kind: 'frame-open',
    policy: 2,
    operator: 'and',
    rule: '2.1',
};

const close: DiagramStep = { kind: 'frame-close', outcome: true };

describe('nest', () => {
    it('returns a flat list unchanged when there are no frames', () => {
        expect(nest([request, request])).toEqual([request, request]);
    });

    it('puts the steps between a matched pair inside the frame', () => {
        expect(nest([open, request, close])).toEqual([
            {
                kind: 'frame',
                policy: 2,
                operator: 'and',
                rule: '2.1',
                outcome: true,
                children: [request],
            },
        ]);
    });

    it('nests a frame inside a frame', () => {
        const inner: DiagramStep = {
            kind: 'frame-open',
            policy: 1,
            operator: 'single',
            rule: '1.1',
        };
        const result = nest([open, inner, request, close, close]);
        expect(result).toHaveLength(1);
        const outer = result[0];
        if (outer.kind !== 'frame') throw new Error('expected a frame');
        expect(outer.children).toEqual([
            {
                kind: 'frame',
                policy: 1,
                operator: 'single',
                rule: '1.1',
                outcome: true,
                children: [request],
            },
        ]);
    });

    it('records the separator as a child of the open frame', () => {
        const result = nest([
            open,
            request,
            { kind: 'frame-separator' },
            request,
            close,
        ]);
        const frame = result[0];
        if (frame.kind !== 'frame') throw new Error('expected a frame');
        expect(frame.children).toEqual([
            request,
            { kind: 'separator', operator: 'and' },
            request,
        ]);
    });

    it("stamps the separator with an or frame's operator", () => {
        const orOpen: DiagramStep = {
            kind: 'frame-open',
            policy: 3,
            operator: 'or',
            rule: '3.1',
        };
        const result = nest([
            orOpen,
            request,
            { kind: 'frame-separator' },
            request,
            close,
        ]);
        const frame = result[0];
        if (frame.kind !== 'frame') throw new Error('expected a frame');
        expect(frame.children).toEqual([
            request,
            { kind: 'separator', operator: 'or' },
            request,
        ]);
    });

    it('drops a separator that belongs to no frame', () => {
        // A truncated trace is a real input, not a bug to assert against.
        expect(nest([{ kind: 'frame-separator' }, request])).toEqual([request]);
    });

    it('drops a close that matches no open', () => {
        expect(nest([close, request])).toEqual([request]);
    });

    it('closes an unclosed frame implicitly at end of input', () => {
        expect(nest([open, request])).toEqual([
            {
                kind: 'frame',
                policy: 2,
                operator: 'and',
                rule: '2.1',
                outcome: null,
                children: [request],
            },
        ]);
    });

    it('returns an empty list for empty input', () => {
        expect(nest([])).toEqual([]);
    });

    it('carries the opening rule id onto the frame', () => {
        const [frame] = nest([open, request, close]);
        if (frame.kind !== 'frame') throw new Error('expected a frame');
        expect(frame.rule).toBe('2.1');
    });
});

const separator = { kind: 'separator', operator: 'and' } as const;

describe('terms', () => {
    it('returns one block when there is no separator', () => {
        expect(terms([request, request])).toEqual([[request, request]]);
    });

    it('splits on each separator, excluding it from the blocks', () => {
        expect(terms([request, separator, request])).toEqual([
            [request],
            [request],
        ]);
    });

    it('drops the empty block a leading separator leaves', () => {
        // A truncated trace is a real input; term numbers follow what is
        // actually drawn.
        expect(terms([separator, request])).toEqual([[request]]);
    });

    it('returns no blocks for empty children', () => {
        expect(terms([])).toEqual([]);
    });
});
