import type { Monaco } from '@monaco-editor/react';
import type { IDisposable, editor } from 'monaco-editor';
import { BART_EXPRESSION_LANGUAGE_ID } from './language';
import {
    completionProviderFor,
    resolvedSpans,
    type BartEditorData,
} from './providers';

/**
 * Completion and inlay hints for a bare `.bart` condition. No formatter and no
 * rule markers: both run `parseSyntax`, which cannot read a bare expression. No
 * hover either, since the inlay hint already renders the name beside the id.
 *
 * Neither this nor `registerBartProviders` owns a completion set; the host
 * component supplies it, which is how the condition field drops clause syntax
 * that is illegal there. `resolvedSpans` runs both party scanners, so a party
 * id gets a hint here the same way a group id does.
 */
export function registerBartExpressionProviders(
    monaco: Monaco,
    read: () => BartEditorData,
): IDisposable[] {
    const completion = completionProviderFor(
        monaco,
        BART_EXPRESSION_LANGUAGE_ID,
        read,
    );

    const inlayHints = monaco.languages.registerInlayHintsProvider(
        BART_EXPRESSION_LANGUAGE_ID,
        {
            provideInlayHints(model: editor.ITextModel) {
                const hints = resolvedSpans(model.getValue(), read()).map(
                    entry => ({
                        position: model.getPositionAt(entry.span.end),
                        // Beside the id, never replacing it: the engine
                        // compares the id.
                        label: entry.name,
                        kind: monaco.languages.InlayHintKind.Parameter,
                        paddingLeft: true,
                    }),
                );
                return { hints, dispose: () => {} };
            },
        },
    );

    return [completion, inlayHints];
}
