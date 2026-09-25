'use client';

import { AttributeEditor } from '@/components/bart/AttributeEditor';
import { FormErrors } from '@/components/states/FormErrors';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAttrVocabulary } from '@/hooks/use-attr-vocabulary';
import { errorMessages } from '@/lib/api/errors';
import { ApiResource, ResourceMetadata } from '@/lib/api/types';
import { BartAttrs } from '@/lib/bart/types';
import { ResourceValues } from '../api';
import { useState } from 'react';

/**
 * The server speaks in terms of its own payload shape. This is the one
 * message a user hits routinely, by submitting an empty form.
 */
const FRIENDLY: Record<string, string> = {
    "metadata: 'name' is required and must be a non-empty string":
        'Name is required',
};

/**
 * Saving is two phases (the row, then its bytes), because content has its own
 * endpoint (`PUT /resources/:id/content`) and cannot ride along in the JSON
 * body. The dialog owns the sequence: `createdId` remembers the row phase 1
 * created, so a retry after a failed upload targets that row, not a new one.
 */
export function ResourceFormDialog({
    resource,
    trigger,
    onCreate,
    onUpdate,
    onUpload,
    onClear,
}: {
    resource?: ApiResource;
    trigger: React.ReactNode;
    onCreate: (values: ResourceValues) => Promise<ApiResource>;
    onUpdate: (id: string, values: ResourceValues) => Promise<ApiResource>;
    onUpload: (id: string, file: File) => Promise<ApiResource>;
    onClear: (id: string) => Promise<ApiResource>;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [attrs, setAttrs] = useState<BartAttrs>({});
    const [file, setFile] = useState<File | null>(null);
    const [removeFile, setRemoveFile] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    // A row that does not parse never reaches `onChange`, so without this the
    // dialog would save the last value that DID parse.
    const [editorValid, setEditorValid] = useState(true);
    // Remounts the editor: it holds per-key drafts locally and this dialog
    // never unmounts it between opens, so without a fresh mount one
    // resource's abandoned draft shows up on the next one.
    const [editorToken, setEditorToken] = useState(0);
    const vocabulary = useAttrVocabulary('all-resources');

    // The server judged the form as submitted, so any edit makes that verdict
    // stale: the errors go when the user acts, not at the next Save.
    function edited<T>(apply: (value: T) => void) {
        return (value: T) => {
            setErrors([]);
            apply(value);
        };
    }

    // `useState` initialisers run once on mount; this component stays mounted
    // between opens, so this resync stops a cancelled edit's draft persisting.
    function handleOpenChange(next: boolean) {
        if (next) {
            setName(resource?.metadata.name ?? '');
            setDescription(
                typeof resource?.metadata.description === 'string'
                    ? resource.metadata.description
                    : '',
            );
            setAttrs(resource?.attrs ?? {});
            setFile(null);
            setRemoveFile(false);
            setCreatedId(null);
            setErrors([]);
            setEditorValid(true);
            setEditorToken(token => token + 1);
        }
        setOpen(next);
    }

    async function save() {
        setBusy(true);
        setErrors([]);
        // PATCH replaces `metadata` wholesale, so the original is spread back
        // in; this dialog's fields cover `name`/`description` only.
        const metadata: ResourceMetadata = { ...resource?.metadata, name };
        if (description.trim()) metadata.description = description;
        else delete metadata.description;

        let createdNow = false;
        try {
            let id = resource?.id ?? createdId;
            if (id === null || id === undefined) {
                const created = await onCreate({ attrs, metadata });
                id = created.id;
                createdNow = true;
                setCreatedId(created.id);
            } else {
                await onUpdate(id, { attrs, metadata });
            }

            if (file) await onUpload(id, file);
            else if (removeFile) await onClear(id);

            setOpen(false);
        } catch (error) {
            const messages = errorMessages(error).map(m => FRIENDLY[m] ?? m);
            setErrors(
                createdNow
                    ? [
                          'The resource was created, but its file did not upload. Fixing this and saving again updates that same resource.',
                          ...messages,
                      ]
                    : messages,
            );
        } finally {
            setBusy(false);
        }
    }

    const editing = resource !== undefined || createdId !== null;
    const existing = resource?.content ?? null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            {/* 2xl, not lg: the attribute rows stack below a 36rem container. */}
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {editing ? 'Edit resource' : 'New resource'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="resourceName">Name *</Label>
                        <Input
                            id="resourceName"
                            required
                            value={name}
                            onChange={edited(
                                (e: React.ChangeEvent<HTMLInputElement>) =>
                                    setName(e.target.value),
                            )}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="resourceDescription">Description</Label>
                        <Input
                            id="resourceDescription"
                            value={description}
                            onChange={edited(
                                (e: React.ChangeEvent<HTMLInputElement>) =>
                                    setDescription(e.target.value),
                            )}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Attributes</Label>
                        {/* Every key here is a demand the granting rule must
                            restate; display fields belong above. */}
                        <AttributeEditor
                            key={editorToken}
                            attrs={attrs}
                            onChange={edited(setAttrs)}
                            onValidityChange={setEditorValid}
                            vocabulary={vocabulary}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="resourceFile">File</Label>
                        <Input
                            id="resourceFile"
                            type="file"
                            onChange={edited(
                                (e: React.ChangeEvent<HTMLInputElement>) => {
                                    setFile(e.target.files?.[0] ?? null);
                                    setRemoveFile(false);
                                },
                            )}
                        />
                        {existing && !file && (
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                    {existing.filename ?? 'file'} ·{' '}
                                    {existing.size} bytes
                                </span>
                                <Button
                                    type="button"
                                    variant={removeFile ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={edited(() =>
                                        setRemoveFile(!removeFile),
                                    )}
                                >
                                    {removeFile
                                        ? 'Will be removed on save'
                                        : 'Remove file'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <FormErrors errors={errors} />
                {!editorValid && (
                    <p className="text-xs text-verdict-deny-fg">
                        Fix the highlighted attribute first
                    </p>
                )}

                <DialogFooter>
                    <Button disabled={busy || !editorValid} onClick={save}>
                        {busy ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
