'use client';

import { NewUserDialog } from '@/components/shell/NewUserDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ScenarioPicker } from './components/ScenarioPicker';

/**
 * What `SessionGate` shows when there are no parties at all.
 *
 * Two paths out, both first-class: load one of the paper's scenarios, or
 * create a party by hand and author its policy from nothing. The second is
 * why the manual trigger is here rather than only in the sidebar switcher.
 */
export function FirstRunLanding() {
    const [creating, setCreating] = useState(false);

    return (
        <div className="mx-auto max-w-2xl space-y-6 py-8">
            <div className="space-y-2 text-center">
                <h1 className="text-2xl font-semibold">Nothing here yet</h1>
                <p className="text-sm text-muted-foreground">
                    There are no parties to evaluate, so every screen is empty.
                    Load one of the scenarios from the Bart paper to get a
                    working policy system, or start from scratch.
                </p>
            </div>

            <ScenarioPicker />

            <div className="flex flex-col items-center gap-2 border-t pt-6">
                <p className="text-sm text-muted-foreground">
                    Or start from scratch:
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreating(true)}
                >
                    Create a party
                </Button>
            </div>
            {creating && <NewUserDialog onClose={() => setCreating(false)} />}
        </div>
    );
}
