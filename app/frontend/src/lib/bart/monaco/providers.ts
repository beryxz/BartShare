import type { Monaco } from '@monaco-editor/react';
import type { IDisposable, Position, editor } from 'monaco-editor';
import { groupIdSpans, partyEqualitySpans, partyIdSpans } from '../highlight';
import { parseSyntax } from '../parse';
import { printTree } from '../rule';
import { BART_LANGUAGE_ID } from './language';

export type BartCompletion = {
    label: string;
    insertText: string;
    detail?: string;
    documentation?: string;
};

export type BartEditorData = {
    completions: BartCompletion[];
    names: ReadonlyMap<string, string>;
    /** Group id to name, for a `"<id>" in requester.groups` condition. */
    groupNames: ReadonlyMap<string, string>;
};

/**
 * Groups as completion items, shared by both editors. Parties complete
 * differently in each (`userId:"<id>"` in a rule body, a bare quoted id in an
 * expression); groups do not, so this is one function rather than two.
 */
export function groupCompletions(
    groups: readonly { id: string; name: string }[],
): BartCompletion[] {
    return groups.map(group => ({
        label: group.name,
        // The engine compares the id; the name is only a label.
        insertText: `"${group.id}"`,
        detail: 'group',
        documentation:
            `Inserts this group's id (${group.id}).\n\n` +
            `Example: "${group.id}" in requester.groups`,
    }));
}

/** A qualified name: a qualifier, a dot, and however much of the member has been
 *  typed. A `qname` qualifier is either a name (`requester.`) or an attribute
 *  pattern, which ends in a paren (`(role:"x").`), so the dot may follow either.
 *  Anchored on a letter or that paren so `300.` is not member position. */
const MEMBER_POSITION = /(?:[A-Za-z_]\w*|\))\.\w*$/;

/**
 * What a party exposes to a condition. Party attribute names are deliberately
 * absent: a list of live user attributes is noise in this position.
 */
const MEMBERS: BartCompletion[] = [
    {
        label: 'userId',
        insertText: 'userId',
        detail: 'party member',
        documentation:
            "The party's id.\n\nExample: requester.userId in connections",
    },
    {
        label: 'groups',
        insertText: 'groups',
        detail: 'party member',
        documentation:
            'The ids of every group the party has joined.\n\n' +
            'Example: "<groupId>" in requester.groups',
    },
];

/**
 * The completions legal where the cursor is. Everything is offered except
 * straight after a qualifying dot, where operators and party names are not
 * valid Bart.
 */
export function completionsAt(
    before: string,
    all: BartCompletion[],
): BartCompletion[] {
    return MEMBER_POSITION.test(before) ? MEMBERS : all;
}

type ResolvedSpan = {
    span: { start: number; end: number; id: string };
    name: string;
    /** Which id space the span belongs to, for the hover text. */
    kind: 'userId' | 'groupId';
};

/**
 * Every annotatable id in the source, resolved to a name. One list over both id
 * spaces, so the inlay-hint and hover providers cannot disagree about what is
 * annotatable. Unresolved ids are dropped and show raw, which is what the
 * engine compares anyway.
 */
export function resolvedSpans(
    source: string,
    data: BartEditorData,
): ResolvedSpan[] {
    // The attribute and equality party forms share one id space. Mid-edit text
    // can satisfy both (`userId:"u-1" = userId`), hence the dedup by offset.
    const seen = new Set<string>();
    const parties = [...partyIdSpans(source), ...partyEqualitySpans(source)]
        .filter(span => {
            const key = `${span.start}:${span.end}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map(span => ({
            span,
            name: data.names.get(span.id),
            kind: 'userId' as const,
        }));
    const groups = groupIdSpans(source).map(span => ({
        span,
        name: data.groupNames.get(span.id),
        kind: 'groupId' as const,
    }));
    return [...parties, ...groups].filter(
        (entry): entry is ResolvedSpan => entry.name !== undefined,
    );
}

/**
 * A completion provider over whatever `read().completions` currently holds.
 * Shared by both editors, which differ only in language id and in the list
 * their host component supplies through `read`.
 */
export function completionProviderFor(
    monaco: Monaco,
    languageId: string,
    read: () => BartEditorData,
): IDisposable {
    return monaco.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems(model: editor.ITextModel, position: Position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };
            const before = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });
            return {
                suggestions: completionsAt(before, read().completions).map(
                    item => ({
                        label: item.label,
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: item.insertText,
                        detail: item.detail,
                        documentation: item.documentation,
                        range,
                    }),
                ),
            };
        },
    });
}

/**
 * Formatting, completion and inlay hints for the `bart` language. Registered
 * per editor mount and disposed on unmount, since every provider depends on
 * live data; `read` is a getter so the callbacks see current data without
 * re-registering. The explicit `model`/`position` annotations are needed:
 * `Monaco` degrades to `any`, so nothing here is contextually typed.
 */
export function registerBartProviders(
    monaco: Monaco,
    read: () => BartEditorData,
): IDisposable[] {
    const formatting = monaco.languages.registerDocumentFormattingEditProvider(
        BART_LANGUAGE_ID,
        {
            provideDocumentFormattingEdits(model: editor.ITextModel) {
                const result = parseSyntax(model.getValue());
                // Nothing to format if it does not parse; the disabled
                // Format button and the sheet already say why.
                if (!result.ok) return [];
                return [
                    {
                        range: model.getFullModelRange(),
                        text: printTree(result.tree),
                    },
                ];
            },
        },
    );

    const completion = completionProviderFor(monaco, BART_LANGUAGE_ID, read);

    const inlayHints = monaco.languages.registerInlayHintsProvider(
        BART_LANGUAGE_ID,
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

    const hover = monaco.languages.registerHoverProvider(BART_LANGUAGE_ID, {
        provideHover(model: editor.ITextModel, position: Position) {
            const offset = model.getOffsetAt(position);
            const entry = resolvedSpans(model.getValue(), read()).find(
                candidate =>
                    offset >= candidate.span.start &&
                    offset <= candidate.span.end,
            );
            if (!entry) return null;
            return {
                range: {
                    startLineNumber: model.getPositionAt(entry.span.start)
                        .lineNumber,
                    startColumn: model.getPositionAt(entry.span.start).column,
                    endLineNumber: model.getPositionAt(entry.span.end)
                        .lineNumber,
                    endColumn: model.getPositionAt(entry.span.end).column,
                },
                contents: [
                    { value: `**${entry.name}**` },
                    {
                        value: `\`${entry.kind}\`: the id is what the engine matches on.`,
                    },
                ],
            };
        },
    });

    return [formatting, completion, inlayHints, hover];
}
