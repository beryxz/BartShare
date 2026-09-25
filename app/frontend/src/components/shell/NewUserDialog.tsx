'use client';

import { AttributeEditor } from '@/components/bart/AttributeEditor';
import { FormErrors } from '@/components/states/FormErrors';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useAttrVocabulary } from '@/hooks/use-attr-vocabulary';
import { errorMessages } from '@/lib/api/errors';
import { createUser } from '@/lib/session/api';
import { useSession } from '@/lib/session/SessionProvider';
import { BartAttrs } from '@/lib/bart/types';
import { useState } from 'react';

/**
 * A party is an attribute list plus rules, so creating one needs no more than
 * the attribute editor. `username` is required, at least 2 characters, and
 * unique, all enforced backend-side, and a violation renders inline.
 *
 * Mounted only while open: the caller renders it as
 * `{creating && <NewUserDialog onClose={...} />}`, so a fresh mount is the
 * reset between opens.
 */
export function NewUserDialog({ onClose }: { onClose: () => void }) {
    const { refresh, switchTo } = useSession();
    const [attrs, setAttrs] = useState<BartAttrs>({ username: '' });
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    // A row that does not parse never reaches `onChange`, so without this the
    // dialog would create the user with the last value that DID parse.
    const [editorValid, setEditorValid] = useState(true);
    const vocabulary = useAttrVocabulary('parties');

    // Save stays enabled with no username: `POST /users` owns that rule, and
    // its 400 renders with the other errors.
    const canSave = !busy && editorValid;

    async function save() {
        setBusy(true);
        setErrors([]);
        try {
            const created = await createUser({ attrs, rules: [] });
            await refresh();
            switchTo(created.id);
            onClose();
        } catch (error) {
            setErrors(errorMessages(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={next => {
                if (!next) onClose();
            }}
        >
            {/* 2xl, not lg: the attribute rows stack below a 36rem container. */}
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>New user</DialogTitle>
                    <DialogDescription>
                        A new party in the policy system. `username` is
                        required, at least 2 characters, and unique; rules are
                        authored afterwards on My Policy.
                    </DialogDescription>
                </DialogHeader>

                <AttributeEditor
                    attrs={attrs}
                    // The server judged the attributes as sent, so any edit
                    // makes that verdict stale: clear it now, not at Save.
                    onChange={next => {
                        setErrors([]);
                        setAttrs(next);
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

                <DialogFooter>
                    <Button disabled={!canSave} onClick={save}>
                        {busy ? 'Creating…' : 'Create and switch to'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
