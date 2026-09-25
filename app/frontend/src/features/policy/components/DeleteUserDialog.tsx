'use client';

import { FormErrors } from '@/components/states/FormErrors';
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
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessages } from '@/lib/api/errors';
import { useState } from 'react';
import { describeAccountSummary } from '../accountSummary';
import { useAccountSummary } from '../hooks/useAccountSummary';

/**
 * Mounted only while open, so the summary fetch is triggered by the open event
 * with no `useEffect` and there is no stale count or error to resync on reopen.
 *
 * A failed or in-flight count never blocks the delete: the counts are a
 * diagnostic. There is no success path either, since a successful delete
 * changes the acting user and `SessionGate` tears this down with every other
 * screen, so `busy` is only ever cleared on failure.
 */
export function DeleteUserDialog({
    username,
    onCancel,
    onConfirm,
}: {
    username: string;
    onCancel: () => void;
    onConfirm: () => Promise<void>;
}) {
    const { summary, isLoading, error: summaryError } = useAccountSummary();
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    const lines = summary ? describeAccountSummary(summary) : [];

    async function confirm() {
        setBusy(true);
        setErrors([]);
        try {
            await onConfirm();
        } catch (error) {
            setErrors(errorMessages(error));
            setBusy(false);
        }
    }

    return (
        <AlertDialog
            open
            onOpenChange={next => {
                if (!next && !busy) onCancel();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {username}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This removes the party from the policy system for
                        everyone, not just from your view, and it cannot be
                        undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2 text-sm">
                    {isLoading ? (
                        <Skeleton className="h-4 w-56" />
                    ) : summaryError ? (
                        <p>
                            What this will destroy could not be loaded, but the
                            delete will still proceed.
                        </p>
                    ) : lines.length > 0 ? (
                        <p>
                            <span className="font-medium">
                                {lines.join(', ')}
                            </span>{' '}
                            will be destroyed. Your connections are removed from
                            the other side too, so the people you are connected
                            to lose the connection as well.
                        </p>
                    ) : summary ? (
                        <p>
                            This party owns no resources, connections or group
                            memberships.
                        </p>
                    ) : (
                        <p>
                            What this will destroy could not be loaded, but the
                            delete will still proceed.
                        </p>
                    )}
                    <p className="text-muted-foreground">
                        Rules belonging to other parties that matched this one
                        stop matching it.
                    </p>
                    <FormErrors errors={errors} />
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={busy}
                        onClick={event => {
                            // The primitive closes on select, which would
                            // unmount this before the request settles.
                            event.preventDefault();
                            void confirm();
                        }}
                    >
                        {busy ? 'Deleting…' : 'Delete user'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
