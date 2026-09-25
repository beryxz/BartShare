'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatusRow } from '../statusRows';

const LABELS: Record<StatusRow['name'], string> = {
    backend: 'Backend',
    database: 'Database',
    evaluator: 'Bart Evaluator',
};

const DESCRIPTIONS: Record<StatusRow['name'], string> = {
    backend: 'The backend APIs the browser talks to',
    database: 'The database holding every party, resource and group',
    evaluator:
        'The Bart engine evaluator service. Required for modifying rules and evaluating any access decision',
};

/**
 * The `up` badge reuses the verdict-permit tokens rather than a raw green so
 * it tracks the theme with the rest of the app's positive verdicts; `unknown`
 * stays neutral (muted outline) because it is an absence of information, not
 * a failure.
 */
const BADGES: Record<
    StatusRow['status'],
    { label: string; className?: string }
> = {
    up: {
        label: 'up',
        className:
            'border-verdict-permit-border bg-verdict-permit-bg text-verdict-permit-fg',
    },
    down: { label: 'down' },
    unknown: { label: 'unknown', className: 'text-muted-foreground' },
};

/**
 * One service, rendered from the derived `StatusRow` view, not the wire
 * `ApiServiceStatus`: a service cannot report its own unreachability, so
 * `statusRows` builds the backend row client-side.
 *
 * `detail` renders only when down. The wire rows carry no address even then,
 * since the endpoint is public and the evaluator URL is internal topology;
 * for the backend row it is the fetch error's message.
 */
export function ServiceStatusCard({ row }: { row: StatusRow }) {
    const badge = BADGES[row.status];

    return (
        <Card>
            <CardContent className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <p className="font-medium">{LABELS[row.name]}</p>
                    <p className="text-sm text-muted-foreground">
                        {DESCRIPTIONS[row.name]}
                    </p>
                    {row.status === 'down' && row.detail && (
                        <p className="text-sm text-verdict-deny-fg">
                            {row.detail}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2 self-center">
                    {row.latencyMs !== null && (
                        <span className="text-xs text-muted-foreground">
                            {row.latencyMs} ms
                        </span>
                    )}
                    <Badge
                        variant={
                            row.status === 'down' ? 'destructive' : 'outline'
                        }
                        className={badge.className}
                    >
                        {badge.label}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}
