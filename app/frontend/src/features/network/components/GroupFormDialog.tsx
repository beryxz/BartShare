'use client';

import { FormErrors } from '@/components/states/FormErrors';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessages } from '@/lib/api/errors';
import { ApiGroup } from '@/lib/api/types';
import { useId, useState } from 'react';
import { GroupValues } from '../api';

/**
 * Create and edit share one dialog: they differ only in which endpoint the
 * submit reaches, and both accept the same two fields.
 *
 * Both fields are sent on edit even when unchanged: `PATCH` accepts a
 * partial body, but resending an equal value is a no-op, so diffing would be
 * logic with no behaviour to justify it.
 */
export function GroupFormDialog({
    group,
    onClose,
    onSubmit,
}: {
    group?: ApiGroup;
    onClose: () => void;
    onSubmit: (values: GroupValues) => Promise<void>;
}) {
    const [name, setName] = useState(group?.name ?? '');
    const [description, setDescription] = useState(group?.description ?? '');
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    // Several of these can be mounted at once (one per row), so a hardcoded
    // id would collide and point every label at the first field on the page.
    const nameId = useId();
    const descriptionId = useId();

    async function save() {
        setBusy(true);
        setErrors([]);
        try {
            await onSubmit({ name, description });
            onClose();
        } catch (failure) {
            // Anything reaching here is the user's to fix; the page handler
            // has already absorbed the staleness cases (isStaleWriteError).
            setErrors(errorMessages(failure));
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {group ? 'Edit group' : 'New group'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor={nameId}>Name</Label>
                        <Input
                            id={nameId}
                            value={name}
                            // The server judged the name as submitted, so any
                            // edit makes that verdict stale: clear it now.
                            onChange={e => {
                                setErrors([]);
                                setName(e.target.value);
                            }}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={descriptionId}>Description</Label>
                        <Input
                            id={descriptionId}
                            value={description}
                            onChange={e => {
                                setErrors([]);
                                setDescription(e.target.value);
                            }}
                        />
                    </div>
                </div>

                <FormErrors errors={errors} />

                <DialogFooter>
                    <Button disabled={busy} onClick={save}>
                        {busy ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
