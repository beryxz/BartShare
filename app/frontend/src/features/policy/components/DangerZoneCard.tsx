'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useState } from 'react';
import { DeleteUserDialog } from './DeleteUserDialog';

/**
 * Owns the trigger and the confirm flag; the dialog is a sibling rendered only
 * while confirming, never a child of the button.
 *
 * There is no "delete some other user": `DELETE /me` is the only endpoint, so
 * deleting a party means switching to it first.
 */
export function DangerZoneCard({
    username,
    onDelete,
}: {
    username: string;
    onDelete: () => Promise<void>;
}) {
    const [confirming, setConfirming] = useState(false);

    return (
        <>
            <Card className="border-destructive/40">
                <CardHeader>
                    <CardTitle className="text-destructive">
                        Delete this user
                    </CardTitle>
                    <CardDescription>
                        Removes this party from the policy system along with
                        everything it owns.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirming(true)}
                    >
                        Delete user
                    </Button>
                </CardContent>
            </Card>

            {confirming && (
                <DeleteUserDialog
                    username={username}
                    onCancel={() => setConfirming(false)}
                    onConfirm={onDelete}
                />
            )}
        </>
    );
}
