'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { triggerDownload } from '@/lib/api/content';
import { ApiResource } from '@/lib/api/types';
import { resourceName } from '@/lib/bart/naming';
import { toastWriteError } from '@/lib/toast';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { downloadContent, ResourceValues } from '../api';
import { ResourceFormDialog } from './ResourceFormDialog';

/**
 * The owner's actions on one of their own resources. Busy state is per row:
 * a shared `busyId` would re-render the whole page on every click and stop
 * two rows acting at once. The icons carry `title`/`aria-label` rather than
 * a Radix tooltip: Edit is `ResourceFormDialog`'s own `DialogTrigger` child,
 * so nothing can wrap it from here.
 */
export function ResourceRowActions({
    resource,
    onCreate,
    onUpdate,
    onUpload,
    onClear,
    onRemove,
}: {
    resource: ApiResource;
    onCreate: (values: ResourceValues) => Promise<ApiResource>;
    onUpdate: (id: string, values: ResourceValues) => Promise<ApiResource>;
    onUpload: (id: string, file: File) => Promise<ApiResource>;
    onClear: (id: string) => Promise<ApiResource>;
    onRemove: (id: string) => Promise<ApiResource>;
}) {
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const name = resourceName(resource);

    async function download() {
        setBusy(true);
        try {
            const { blob, filename } = await downloadContent(resource.id);
            triggerDownload(blob, filename ?? name);
        } catch (failure) {
            toastWriteError(failure);
        } finally {
            setBusy(false);
        }
    }

    async function destroy() {
        setBusy(true);
        try {
            await onRemove(resource.id);
            toast.success(`Deleted “${name}”.`);
        } catch (failure) {
            toastWriteError(failure);
        } finally {
            // On success the row is already gone (`onRemove` revalidates
            // `/me/resources` first), so this only un-sticks the failure path.
            setBusy(false);
        }
    }

    return (
        <div className="flex items-center gap-1">
            <ResourceFormDialog
                resource={resource}
                trigger={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit"
                        aria-label={`Edit ${name}`}
                    >
                        <Pencil />
                    </Button>
                }
                onCreate={onCreate}
                onUpdate={onUpdate}
                onUpload={onUpload}
                onClear={onClear}
            />

            {/* Omitted rather than disabled: the file badge already says
                "No file", so a disabled button would just repeat that. */}
            {resource.content && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Download"
                    aria-label={`Download ${name}`}
                    disabled={busy}
                    onClick={download}
                >
                    <Download />
                </Button>
            )}

            <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                title="Delete"
                aria-label={`Delete ${name}`}
                disabled={busy}
                onClick={() => setConfirming(true)}
            >
                <Trash2 />
            </Button>

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        {/* Naming the resource guards against a misclick on
                            the wrong card's icon; a generic "Are you sure?"
                            would not catch that. */}
                        <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This deletes the resource and any file attached to
                            it. It cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirming(false);
                                destroy();
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
