import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { parseSyntax } from '../parse';

export const BART_MARKER_OWNER = 'bart';

/**
 * Parse failures as editor squiggles. Only positioned failures become markers:
 * `parseSyntax` also fails on valid Bart with no position, such as a reserved
 * keyword used as an attribute name, and underlining that would be a false
 * claim. Stage one alone: only it ever produces a position to squiggle.
 *
 * The evaluator decides validity; a clean editor is no promise the save will
 * succeed.
 */
export function markersFor(
    monaco: Monaco,
    model: editor.ITextModel,
): editor.IMarkerData[] {
    const result = parseSyntax(model.getValue());
    if (result.ok || !result.at) return [];

    const { line, column } = result.at;
    // To end of line: the parser reports where it gave up, not a span.
    const endColumn = model.getLineMaxColumn(
        Math.min(line, model.getLineCount()),
    );

    return [
        {
            severity: monaco.MarkerSeverity.Error,
            message: result.reason,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: Math.max(endColumn, column + 1),
        },
    ];
}
