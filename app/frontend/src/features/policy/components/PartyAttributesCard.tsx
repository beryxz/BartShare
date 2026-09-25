'use client';

import { AttributeEditor } from '@/components/bart/AttributeEditor';
import { FormErrors } from '@/components/states/FormErrors';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useAttrVocabulary } from '@/hooks/use-attr-vocabulary';
import { errorMessages } from '@/lib/api/errors';
import { BartAttrs } from '@/lib/bart/types';
import { useState } from 'react';

/**
 * Holds a draft rather than writing through: `AttributeEditor` fires on every
 * keystroke and `PATCH /me` revalidates the whole policy.
 *
 * `draft === null` means "follow the server", the state a successful save
 * restores. Unlike a dialog this card stays mounted, and `AttributeEditor`
 * keeps per-key local state a prop change cannot clear, so `revertToken`
 * forces the remount Revert needs.
 */
export function PartyAttributesCard({
    attrs,
    onSave,
}: {
    attrs: BartAttrs;
    onSave: (next: BartAttrs) => Promise<void>;
}) {
    const [draft, setDraft] = useState<BartAttrs | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [revertToken, setRevertToken] = useState(0);
    // A row that does not parse never reaches `onChange`, so without this the
    // card would save the last value that DID parse and `PATCH /me` would
    // answer 200 to a coercion nobody asked for.
    const [editorValid, setEditorValid] = useState(true);
    const vocabulary = useAttrVocabulary('parties');

    const shown = draft ?? attrs;
    const dirty = draft !== null;

    async function save() {
        if (draft === null) return;
        setBusy(true);
        setErrors([]);
        try {
            await onSave(draft);
            setDraft(null);
        } catch (error) {
            // Keep the draft: it is the only copy of what the user typed.
            setErrors(errorMessages(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Party attributes</CardTitle>
                <CardDescription>
                    Who you are to the evaluator. Other parties&apos; rules
                    match against these, and your own conditions can read them.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <AttributeEditor
                    key={revertToken}
                    attrs={shown}
                    // The server judged the attributes as sent, so any edit
                    // makes that verdict stale: clear it now, not at Save.
                    onChange={next => {
                        setErrors([]);
                        setDraft(next);
                    }}
                    onValidityChange={setEditorValid}
                    vocabulary={vocabulary}
                />
                <FormErrors errors={errors} />
                {!editorValid && (
                    <p className="text-xs text-verdict-deny-fg">
                        Fix the highlighted attribute first
                    </p>
                )}
            </CardContent>
            <CardFooter className="gap-2">
                <Button
                    size="sm"
                    disabled={!dirty || busy || !editorValid}
                    onClick={save}
                >
                    {busy ? 'Saving…' : 'Save'}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    // `dirty` alone is not enough: a first edit that fails to
                    // parse never reaches `onChange`, so no draft exists and
                    // the row that disabled Save would disable its way out.
                    disabled={(!dirty && editorValid) || busy}
                    onClick={() => {
                        setDraft(null);
                        setErrors([]);
                        setEditorValid(true);
                        setRevertToken(token => token + 1);
                    }}
                >
                    Revert
                </Button>
                {dirty && (
                    <span className="text-xs text-warn-fg">
                        Unsaved changes
                    </span>
                )}
            </CardFooter>
        </Card>
    );
}
