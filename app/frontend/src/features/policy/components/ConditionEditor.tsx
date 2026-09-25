'use client';

import { useMyContextNames } from '@/features/policy/hooks/usePolicy';
import { BartExpressionEditor } from '@/components/bart/BartEditor';
import type { BartCompletion } from '@/components/bart/BartEditor';
import { useGroupNames } from '@/hooks/use-group-names';
import { useMyGroups } from '@/hooks/use-my-groups';
import { useUserNames } from '@/hooks/use-user-names';
import { groupCompletions } from '@/lib/bart/monaco/providers';
import { userName } from '@/lib/bart/naming';
import { useSession } from '@/lib/session/SessionProvider';
import { useMemo } from 'react';

/**
 * Expression vocabulary, scoped to what is legal inside a condition.
 *
 * Not the rule editor's list: `resource:(`, `exchange:(`, `to:` and `from:` are
 * clause syntax and cannot appear in an expression.
 */
const EXPRESSION_SYNTAX: BartCompletion[] = [
    { label: 'requester', insertText: 'requester.', detail: 'whoever asked' },
    { label: 'me', insertText: 'me.', detail: 'the policy owner' },
    { label: 'and', insertText: 'and ', detail: 'operator' },
    { label: 'or', insertText: 'or ', detail: 'operator' },
    { label: 'not', insertText: 'not ', detail: 'operator' },
    { label: 'in', insertText: 'in ', detail: 'membership test' },
];

/**
 * The condition, as a one-line Monaco field holding verbatim `.bart`
 * expression source: a syntax-aware text field, not a builder. No squiggles:
 * `markersFor` runs `parseRule`, which reads a whole rule, so a bare
 * condition would underline on every keystroke. Parties and groups complete
 * to a BARE QUOTED ID here, unlike the rule body's `userId:"<id>"`: in an
 * expression both are compared as values.
 */
export function ConditionEditor({
    value,
    onChange,
}: {
    value: string;
    onChange: (next: string) => void;
}) {
    const { users } = useSession();
    const names = useUserNames();
    const groupNames = useGroupNames(value);
    const contextNames = useMyContextNames();
    const myGroups = useMyGroups();

    const completions = useMemo<BartCompletion[]>(
        () => [
            ...EXPRESSION_SYNTAX,
            ...contextNames.map(entry => ({
                label: entry.key,
                insertText: entry.key,
                detail: `context: ${entry.providedBy}`,
                documentation: `${entry.description}\n\nExample: ${entry.example}`,
            })),
            ...users.map(user => ({
                label: userName(user),
                insertText: `"${user.id}"`,
                detail: 'party',
                documentation:
                    `Inserts this party's userId (${user.id}).\n\n` +
                    `Example: requester.userId = "${user.id}"`,
            })),
            ...groupCompletions(myGroups),
        ],
        [contextNames, users, myGroups],
    );

    return (
        <BartExpressionEditor
            singleLine
            markers={false}
            value={value}
            onChange={onChange}
            completions={completions}
            names={names}
            groupNames={groupNames}
            ariaLabel="Condition"
        />
    );
}
