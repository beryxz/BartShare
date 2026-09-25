'use client';

import { BartCompletion, BartEditor } from '@/components/bart/BartEditor';
import { Button } from '@/components/ui/button';
import { useMyContextNames } from '@/features/policy/hooks/usePolicy';
import { useGroupNames } from '@/hooks/use-group-names';
import { useMyGroups } from '@/hooks/use-my-groups';
import { useStickyFlag } from '@/hooks/use-sticky-flag';
import { useUserNames } from '@/hooks/use-user-names';
import { parseSyntax } from '@/lib/bart/parse';
import { groupCompletions } from '@/lib/bart/monaco/providers';
import { printTree } from '@/lib/bart/rule';
import { userName } from '@/lib/bart/naming';
import { useSession } from '@/lib/session/SessionProvider';
import { WrapText } from 'lucide-react';
import type { editor } from 'monaco-editor';
import { useMemo } from 'react';

const SYNTAX: BartCompletion[] = [
    { label: 'resource', insertText: 'resource:(', detail: 'clause' },
    { label: 'condition', insertText: 'condition:(', detail: 'clause' },
    { label: 'exchange', insertText: 'exchange:(', detail: 'clause' },
    { label: 'to', insertText: 'to:', detail: 'exchange term' },
    { label: 'from', insertText: 'from:', detail: 'exchange term' },
    { label: 'me', insertText: 'me', detail: 'the policy owner' },
    { label: 'requester', insertText: 'requester', detail: 'whoever asked' },
    { label: 'any', insertText: 'any:', detail: 'one matching party' },
    { label: 'all', insertText: 'all:', detail: 'every matching party' },
];

/**
 * Full `.bart` rule text, in Monaco.
 *
 * The client parser drives the squiggles, the formatter, and which editor a
 * rule opens in. The evaluator decides whether the text is really valid, and
 * its 400 renders beside this editor, so a clean editor is no promise that the
 * save will succeed.
 */
export function AdvancedRuleEditor({
    source,
    onChange,
    onReady,
}: {
    source: string;
    onChange: (next: string) => void;
    onReady?: (instance: editor.IStandaloneCodeEditor) => void;
}) {
    const { users } = useSession();
    const names = useUserNames();
    const contextNames = useMyContextNames();
    const groupNames = useGroupNames(source);
    const myGroups = useMyGroups();

    const completions = useMemo<BartCompletion[]>(
        () => [
            ...SYNTAX,
            ...contextNames.map(entry => ({
                label: entry.key,
                insertText: entry.key,
                detail: `context: ${entry.providedBy}`,
                documentation: `${entry.description}\n\nExample: ${entry.example}`,
            })),
            ...users.map(user => ({
                label: userName(user),
                // A party is named by userId; a username is not a policy
                // identifier and cannot be matched on.
                insertText: `userId:"${user.id}"`,
                detail: 'party',
                documentation: `Inserts this party's userId (${user.id}).`,
            })),
            ...groupCompletions(myGroups),
        ],
        [contextNames, users, myGroups],
    );

    const [wrap, setWrap] = useStickyFlag('bart.editor.wrap', true);

    const parsed = parseSyntax(source);

    return (
        <div className="space-y-2">
            <BartEditor
                value={source}
                onChange={onChange}
                completions={completions}
                names={names}
                groupNames={groupNames}
                wordWrap={wrap ? 'on' : 'off'}
                onReady={onReady}
            />
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!parsed.ok}
                    onClick={() =>
                        parsed.ok && onChange(printTree(parsed.tree))
                    }
                >
                    Format
                </Button>
                <Button
                    variant={wrap ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={wrap}
                    onClick={() => setWrap(!wrap)}
                >
                    <WrapText />
                    Wrap
                </Button>
                <p className="text-xs text-muted-foreground">
                    Anything the block editor can show stays editable there too.
                    Switch back whenever the text is block-shaped.
                </p>
            </div>
        </div>
    );
}
