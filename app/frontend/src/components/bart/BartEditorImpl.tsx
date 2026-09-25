'use client';

import {
    BART_EXPRESSION_LANGUAGE_ID,
    BART_LANGUAGE_ID,
    registerBart,
    registerBartExpression,
} from '@/lib/bart/monaco/language';
import { registerBartExpressionProviders } from '@/lib/bart/monaco/expression';
import { BART_MARKER_OWNER, markersFor } from '@/lib/bart/monaco/markers';
import {
    BartCompletion,
    BartEditorData,
    registerBartProviders,
} from '@/lib/bart/monaco/providers';
import { Editor, loader, type Monaco } from '@monaco-editor/react';
import type { IDisposable, editor } from 'monaco-editor';
import { useEffect, useRef } from 'react';

// Serve Monaco from this origin, never from jsdelivr. Module scope, so it is
// set before any Editor mounts.
loader.config({ paths: { vs: '/monaco/vs' } });

export function BartEditorImpl({
    value,
    onChange,
    height,
    completions = [],
    names,
    groupNames,
    wordWrap = 'on',
    singleLine = false,
    markers = true,
    ariaLabel,
    onReady,
}: {
    value: string;
    onChange: (next: string) => void;
    /** Defaults to a full editor, or one line in `singleLine` mode. */
    height?: string;
    completions?: BartCompletion[];
    names?: ReadonlyMap<string, string>;
    /** Group id to display name, for a membership condition. */
    groupNames?: ReadonlyMap<string, string>;
    /** Defaults to `'on'`, forced to `'off'` under `singleLine` whatever is
     *  passed here. */
    wordWrap?: 'on' | 'off';
    /**
     * Renders as a one-line field: no line numbers, glyph margin, folding or
     * ruler, and Enter never inserts a newline. Selects `bart-expression`,
     * since a one-line field is always a condition and never a whole rule.
     */
    singleLine?: boolean;
    /** Whether parse failures become squiggles. Off for a condition:
     *  `markersFor` runs `parseSyntax`, and a bare expression is not a rule, so
     *  every keystroke would be underlined. */
    markers?: boolean;
    /** Accessible name; Monaco is not a labelable element, so `htmlFor` cannot reach it. */
    ariaLabel?: string;
    /** Hands the mounted editor to the host. A callback, not a ref, since
     *  `BartEditor` is a `next/dynamic` wrapper. */
    onReady?: (instance: editor.IStandaloneCodeEditor) => void;
}) {
    const languageId = singleLine
        ? BART_EXPRESSION_LANGUAGE_ID
        : BART_LANGUAGE_ID;
    const resolvedHeight = height ?? (singleLine ? '2.25rem' : '20rem');
    // Providers read this ref, so late-arriving users and context keys reach
    // them without re-registering. Written after commit, never during render.
    const dataRef = useRef<BartEditorData>({
        completions,
        names: names ?? new Map(),
        groupNames: groupNames ?? new Map(),
    });
    useEffect(() => {
        dataRef.current = {
            completions,
            names: names ?? new Map(),
            groupNames: groupNames ?? new Map(),
        };
    });

    const disposables = useRef<IDisposable[]>([]);
    useEffect(
        () => () => {
            disposables.current.forEach(d => d.dispose());
            disposables.current = [];
        },
        [],
    );

    function handleMount(
        instance: editor.IStandaloneCodeEditor,
        monaco: Monaco,
    ) {
        disposables.current = singleLine
            ? registerBartExpressionProviders(monaco, () => dataRef.current)
            : registerBartProviders(monaco, () => dataRef.current);

        if (singleLine) {
            // `onKeyDown`, never `addCommand`. The suggest-widget probe is
            // best-effort: if it stops matching, Enter suppresses rather than
            // accepts, and the field stays one line.
            disposables.current.push(
                instance.onKeyDown(event => {
                    if (event.keyCode !== monaco.KeyCode.Enter) return;
                    if (
                        instance
                            .getDomNode()
                            ?.querySelector('.suggest-widget.visible')
                    )
                        return;
                    event.preventDefault();
                    event.stopPropagation();
                }),
            );
        }

        // Before the model guard below: `RuleEditorSheet`'s Escape probe needs
        // the instance even when there is no model to mark up.
        onReady?.(instance);
        const model = instance.getModel();
        if (!model || !markers) return;
        const publish = () =>
            monaco.editor.setModelMarkers(
                model,
                BART_MARKER_OWNER,
                markersFor(monaco, model),
            );
        publish();
        disposables.current.push(model.onDidChangeContent(publish));
    }

    return (
        <div className="overflow-hidden rounded-md border">
            <Editor
                height={resolvedHeight}
                language={languageId}
                // Distinct paths, not a label: two `<Editor>`s that both omit
                // `path` share one model, its value and its language.
                path={singleLine ? 'condition.bart-expression' : 'rule.bart'}
                // Pinned: `.bart` reads as a code surface in either app theme.
                theme="vs-dark"
                value={value}
                beforeMount={(monaco: Monaco) =>
                    singleLine
                        ? registerBartExpression(monaco)
                        : registerBart(monaco)
                }
                onMount={handleMount}
                onChange={next => {
                    const text = next ?? '';
                    // A paste bypasses the Enter binding, so multi-line values
                    // flatten here. Spaces: `a\nand b` must not become `aand b`.
                    onChange(singleLine ? text.replace(/[\r\n]+/g, ' ') : text);
                }}
                options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbersMinChars: 3,
                    folding: false,
                    fontSize: 12,
                    wordWrap,
                    automaticLayout: true,
                    tabSize: 4,
                    // Positions widgets `fixed`, escaping `overflow-hidden`;
                    // an ancestor `transform`, `filter` or `contain` clips.
                    fixedOverflowWidgets: true,
                    ...(singleLine
                        ? {
                              lineNumbers: 'off' as const,
                              glyphMargin: false,
                              // Insets like an input's padding, in Monaco:
                              // the 2.25rem box still fits the `h-9` skeleton.
                              lineDecorationsWidth: 8,
                              padding: { top: 8, bottom: 8 },
                              lineNumbersMinChars: 0,
                              overviewRulerLanes: 0,
                              overviewRulerBorder: false,
                              renderLineHighlight: 'none' as const,
                              contextmenu: false,
                              scrollbar: {
                                  vertical: 'hidden' as const,
                                  horizontalScrollbarSize: 6,
                              },
                              scrollBeyondLastColumn: 0,
                              // Overrides the `wordWrap` prop above.
                              wordWrap: 'off' as const,
                              // Tab moves focus instead of indenting; an open
                              // suggest widget still gets first refusal.
                              tabFocusMode: true,
                          }
                        : {
                              padding: { top: 4 },
                          }),
                    ...(ariaLabel ? { ariaLabel } : {}),
                }}
            />
        </div>
    );
}
