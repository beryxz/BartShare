'use client';

import { BartCode } from '@/components/bart/BartCode';
import { Button } from '@/components/ui/button';
import { useGroupNames } from '@/hooks/use-group-names';
import { useUserNames } from '@/hooks/use-user-names';
import { RuleCoverageEntry } from '@/lib/api/types';
import { isSyntaxReason, NOT_REPRESENTABLE_REASON } from '@/lib/bart/parse';
import { PolicyRule } from '@/lib/bart/rule';
import { cn } from '@/lib/utils';
import { RuleCoverage } from './RuleCoverage';

export function RuleCard({
    rule,
    index,
    entry,
    total,
    onEdit,
    onDelete,
    busy,
}: {
    rule: PolicyRule;
    index: number;
    entry: RuleCoverageEntry | undefined;
    total: number;
    onEdit: () => void;
    onDelete: () => void;
    busy?: boolean;
}) {
    const names = useUserNames();
    const groupNames = useGroupNames(rule.source);
    const advanced = rule.ast === null;
    return (
        <div id={rule.id} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                    rule #{index + 1}
                </span>
                <span
                    className={cn(
                        'rounded-sm border px-1.5 font-mono text-[10px]',
                        advanced
                            ? 'border-exchange/40 text-exchange'
                            : 'text-muted-foreground',
                    )}
                >
                    {advanced ? 'advanced' : 'simple'}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={busy}
                    onClick={onEdit}
                >
                    Edit
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={onDelete}
                >
                    Delete
                </Button>
            </div>
            <BartCode
                source={rule.source}
                names={names}
                groupNames={groupNames}
            />
            <div className="mt-2">
                <RuleCoverage entry={entry} total={total} />
            </div>
            {/* The positioned reason is an error; red. MIXED_EXCHANGE_REASON
                stays sheet-only ("Edit it here in Advanced"), everywhere else
                that text would be reachable through Edit anyway. */}
            {rule.advancedReason && isSyntaxReason(rule.advancedReason) && (
                <p className="mt-2 text-xs text-verdict-deny-fg">
                    {rule.advancedReason}
                </p>
            )}
            {rule.advancedReason === NOT_REPRESENTABLE_REASON && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {rule.advancedReason}
                </p>
            )}
        </div>
    );
}
