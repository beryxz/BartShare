import type { Monaco } from '@monaco-editor/react';

export const BART_LANGUAGE_ID = 'bart';

/**
 * A second language id over the same tokenizer, for editing a bare condition.
 * Monaco registers providers per language, globally, so a condition-scoped
 * completion set under `bart` would offer `resource:(` inside the full rule
 * editor. A second id makes that bleed impossible.
 */
export const BART_EXPRESSION_LANGUAGE_ID = 'bart-expression';

const LANGUAGE_CONFIGURATION = {
    comments: { lineComment: '#' },
    brackets: [
        ['(', ')'],
        ['{', '}'],
    ],
    autoClosingPairs: [
        { open: '(', close: ')' },
        { open: '{', close: '}' },
        { open: '"', close: '"' },
    ],
    surroundingPairs: [
        { open: '(', close: ')' },
        { open: '{', close: '}' },
        { open: '"', close: '"' },
    ],
};

const TOKENS = {
    defaultToken: '',
    clauses: [
        'party',
        'rules',
        'resource',
        'condition',
        'exchange',
        'to',
        'from',
    ],
    participants: ['me', 'requester', 'any', 'all'],
    operators: ['and', 'or', 'not', 'in'],
    tokenizer: {
        root: [
            [/#.*$/, 'comment'],
            // One rule for the whole literal, so nothing inside a string
            // is ever tokenised as a keyword.
            [/"(?:[^"\\]|\\.)*"/, 'string'],
            [/-?\d+(?:\.\d+)?/, 'number'],
            // BOOL before NAME, exactly as the grammar orders them.
            [/\b(?:true|false)\b/, 'keyword.bool'],
            [
                /[a-zA-Z_][a-zA-Z_0-9]*/,
                {
                    cases: {
                        '@clauses': 'keyword',
                        '@participants': 'type',
                        '@operators': 'operator',
                        '@default': 'identifier',
                    },
                },
            ],
            [/[!<>=]+/, 'operator'],
            [/[(){}:,.]/, 'delimiter'],
        ],
    },
};

function registerLanguage(monaco: Monaco, id: string): void {
    // The annotation is needed: `Monaco` degrades to `any` here.
    const existing = monaco.languages
        .getLanguages()
        .some((language: { id: string }) => language.id === id);
    // `beforeMount` fires per editor instance, and registering twice stacks
    // duplicate providers rather than replacing them.
    if (existing) return;

    monaco.languages.register({ id });
    monaco.languages.setLanguageConfiguration(id, LANGUAGE_CONFIGURATION);
    monaco.languages.setMonarchTokensProvider(id, TOKENS);
}

/**
 * Monarch is a declarative state machine and cannot be handed a function, so
 * `TOKENS` is a forced second encoding of the lexer rules. Keep it in step with
 * `lex.ts`, which is the authority: this one only decides colour.
 *
 * The theme is Monaco's stock `vs`/`vs-dark`, so colours differ slightly from
 * the read-only preview, whose palette lives in Tailwind CSS variables that a
 * Monaco theme cannot read.
 */
export function registerBart(monaco: Monaco): void {
    registerLanguage(monaco, BART_LANGUAGE_ID);
}

/**
 * The expression language. Identical highlighting by construction: the same
 * tokenizer object, so a condition can never colour differently in the two
 * editors.
 */
export function registerBartExpression(monaco: Monaco): void {
    registerLanguage(monaco, BART_EXPRESSION_LANGUAGE_ID);
}
