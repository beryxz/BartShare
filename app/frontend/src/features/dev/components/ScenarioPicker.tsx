'use client';

import { FormErrors } from '@/components/states/FormErrors';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { errorMessages } from '@/lib/api/errors';
import { userName } from '@/lib/bart/naming';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiScenario } from '../api';
import { CREATED_KINDS, describeCounts } from '../counts';
import { useDevActions } from '../hooks/useDevActions';
import { useScenarios } from '../hooks/useScenarios';

/**
 * The scenario catalogue: live on the first-run screen, read-only on `/debug`,
 * which `SessionGate` renders only once an acting user exists, so a Load button
 * there would sit permanently disabled. A successful seed tears this component
 * down, so `busyId` clears only on failure.
 */
export function ScenarioPicker({ readOnly = false }: { readOnly?: boolean }) {
    const { scenarios, isLoading, error } = useScenarios();
    const { seed } = useDevActions();
    const router = useRouter();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errors, setErrors] = useState<string[]>([]);

    async function load(scenario: ApiScenario) {
        setBusyId(scenario.id);
        setErrors([]);
        try {
            const { actingUser } = await seed(scenario.id);
            // Safe after the seed tears this component down: both are global.
            toast.success(
                actingUser
                    ? `Loaded ${scenario.title}, you are now ${userName(actingUser)}.`
                    : `Loaded ${scenario.title}.`,
            );
            router.push('/explore');
        } catch (failure) {
            setErrors(errorMessages(failure));
            setBusyId(null);
        }
    }

    if (isLoading) return <ListSkeleton />;
    // Not an ErrorState: on the first-run screen this sits under a heading
    // that already explains the situation, and on /debug it sits above the
    // reset card, which stays usable when the catalogue does not load.
    if (error)
        return (
            <p className="text-sm text-muted-foreground">
                The scenario catalogue could not be loaded.
            </p>
        );

    return (
        <div className="space-y-3">
            {scenarios.map(scenario => (
                <Card key={scenario.id}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {scenario.title}
                            <span className="rounded-sm border px-1.5 py-0 font-mono text-xs font-normal text-muted-foreground">
                                {scenario.id}
                            </span>
                        </CardTitle>
                        <CardDescription>{scenario.summary}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                            Creates{' '}
                            {describeCounts(
                                scenario.counts,
                                CREATED_KINDS,
                            ).join(', ')}
                            .
                        </p>
                        {!readOnly && (
                            <Button
                                size="sm"
                                disabled={busyId !== null}
                                onClick={() => void load(scenario)}
                            >
                                {busyId === scenario.id ? 'Loading…' : 'Load'}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ))}
            <FormErrors errors={errors} />
        </div>
    );
}
