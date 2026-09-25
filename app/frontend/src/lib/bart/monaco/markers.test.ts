import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { describe, expect, it } from 'vitest';
import { markersFor } from './markers';

/** Only `MarkerSeverity` is read, and its `Error` is monaco's own value. */
const monaco = { MarkerSeverity: { Error: 8 } } as unknown as Monaco;

/**
 * Enough model to place a marker. `lineCount` is separate from the text on
 * purpose: the clamp exists for the case where the two disagree.
 */
function fakeModel(source: string, lineCount?: number) {
    const lines = source.split('\n');
    const asked: number[] = [];
    const model = {
        getValue: () => source,
        getLineCount: () => lineCount ?? lines.length,
        getLineMaxColumn: (line: number) => {
            asked.push(line);
            return (lines[line - 1] ?? '').length + 1;
        },
    } as unknown as editor.ITextModel;
    return { model, asked };
}

const FIRST_LINE = '(resource:(type:"x"),';
const BAD_SECOND_LINE = ' exchange:(to:me, resource:(type:@)))';

describe('markersFor', () => {
    it('marks nothing when the source parses', () => {
        const { model } = fakeModel('(resource:(type:"x"))');

        expect(markersFor(monaco, model)).toEqual([]);
    });

    /**
     * A reserved keyword as an attribute name is valid Bart the block editor
     * cannot represent, and it fails with no position, so squiggling it would
     * claim a syntax error that is not there.
     */
    it('marks nothing when the failure carries no position', () => {
        const { model } = fakeModel('(resource:(to:"x"))');

        expect(markersFor(monaco, model)).toEqual([]);
    });

    it('spans from the reported position to the end of its line', () => {
        const { model } = fakeModel(`${FIRST_LINE}\n${BAD_SECOND_LINE}`);

        expect(markersFor(monaco, model)).toEqual([
            {
                severity: 8,
                message: "Line 2:34: unexpected character '@'",
                startLineNumber: 2,
                startColumn: BAD_SECOND_LINE.indexOf('@') + 1,
                endLineNumber: 2,
                endColumn: BAD_SECOND_LINE.length + 1,
            },
        ]);
    });

    /**
     * A failure at end of input reports one past the last character, where the
     * line's max column is the same column: without the floor the span is empty
     * and monaco draws nothing.
     */
    it('always spans at least one column', () => {
        const source = '(resource:(type:"x")';
        const { model } = fakeModel(source);

        const [marker] = markersFor(monaco, model);

        expect(marker.startColumn).toBe(source.length + 1);
        expect(marker.endColumn).toBe(marker.startColumn + 1);
    });

    /** A line past the model's own count would throw in a real monaco model. */
    it('clamps the line it measures to the model', () => {
        const { model, asked } = fakeModel(
            `${FIRST_LINE}\n${BAD_SECOND_LINE}`,
            1,
        );

        const [marker] = markersFor(monaco, model);

        expect(asked).toEqual([1]);
        expect(marker.startLineNumber).toBe(2);
    });
});
