import { AccessVerdict } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const STYLES: Record<AccessVerdict, { label: string; className: string }> = {
    permitted: {
        label: 'permitted',
        className:
            'bg-verdict-permit-bg text-verdict-permit-fg border-verdict-permit-border',
    },
    denied: {
        label: 'denied',
        className:
            'bg-verdict-deny-bg text-verdict-deny-fg border-verdict-deny-border',
    },
    'denied-exception': {
        label: 'denied · exception',
        className:
            'bg-verdict-error-bg text-verdict-error-fg border-verdict-error-border',
    },
};

export function VerdictBadge({ verdict }: { verdict: AccessVerdict }) {
    const style = STYLES[verdict];
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-sm border px-2 py-0.5',
                'font-mono text-xs font-medium',
                style.className,
            )}
        >
            {style.label}
        </span>
    );
}
