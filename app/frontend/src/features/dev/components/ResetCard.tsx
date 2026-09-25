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
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { errorMessages } from '@/lib/api/errors';
import { useState } from 'react';
import { useDevActions } from '../hooks/useDevActions';

/**
 * The confirm dialog, mounted only while open. Names what will be destroyed
 * with no pre-flight count, no endpoint counting globally. It has no success
 * path either: a successful reset empties `/users`, dropping `SessionGate` to
 * its zero-users branch and unmounting this page with it.
 */
function ResetDialog({
    onCancel,
    onConfirm,
}: {
    onCancel: () => void;
    onConfirm: () => Promise<void>;
}) {
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

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
                    <AlertDialogTitle>Reset the database?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This destroys every party, resource, group, connection
                        and log event, for everyone, and it cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                        You will land back on the first-run screen, where you
                        can load one of the paper&apos;s scenarios.
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
                            // The primitive closes on select by default, unmounting this
                            // before the request settles and losing any error message.
                            event.preventDefault();
                            void confirm();
                        }}
                    >
                        {busy ? 'Resetting…' : 'Reset everything'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function ResetCard() {
    const { reset } = useDevActions();
    const [open, setOpen] = useState(false);

    return (
        <Card className="border-destructive/50">
            <CardHeader>
                <CardTitle>Reset the database</CardTitle>
                <CardDescription>
                    Deletes everything and returns the app to its first-run
                    state. Seeding a scenario is only possible from a fresh
                    state.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="destructive" onClick={() => setOpen(true)}>
                    Reset everything
                </Button>
                {open && (
                    <ResetDialog
                        onCancel={() => setOpen(false)}
                        onConfirm={async () => {
                            await reset();
                        }}
                    />
                )}
            </CardContent>
        </Card>
    );
}
