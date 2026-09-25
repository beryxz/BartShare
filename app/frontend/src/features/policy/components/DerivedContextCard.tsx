import { AttributeList } from '@/components/bart/AttributeList';
import { BartCode } from '@/components/bart/BartCode';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ApiContext } from '@/lib/api/types';
import { contextRows, ContextRow } from '../context';
import { useStickyFlag } from '@/hooks/use-sticky-flag';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Read-only on purpose: context is computed per evaluation from connections,
 * group memberships and the clock, so a value typed here would be overwritten
 * by its provider.
 *
 * Shows the display name with the id beneath it, because the id is what a
 * condition matches on and the name is what a human can read.
 */
function Rows({ label, rows }: { label: string; rows: ContextRow[] }) {
    return (
        <div className="space-y-1">
            <p className="font-mono text-xs text-bart-key">{label}</p>
            {rows.length === 0 ? (
                // "none", never "any (wildcard)": that reading belongs to an
                // attribute *pattern*, and this collection is genuinely empty.
                <p className="font-mono text-xs text-muted-foreground">none</p>
            ) : (
                <ul className="space-y-0.5">
                    {rows.map(row => (
                        <li key={row.id} className="text-xs">
                            {row.label}{' '}
                            <span className="font-mono text-muted-foreground">
                                {row.id}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function DerivedContextCard({
    context,
}: {
    context: ApiContext | undefined;
}) {
    const [open, setOpen] = useStickyFlag('bart.derivedContext.open', false);

    if (!context) return null;
    const rows = contextRows(context);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5">
                        <CardTitle>Derived context</CardTitle>
                        <CardDescription>
                            Read-only preview of the context computed for you at
                            evaluation time. Remember that rules match on the
                            ids, not on the names.
                        </CardDescription>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpen(!open)}
                        aria-expanded={open}
                    >
                        {open ? (
                            <ChevronUp className="size-4" />
                        ) : (
                            <ChevronDown className="size-4" />
                        )}
                        {open ? 'Hide' : 'Show'}
                    </Button>
                </div>
            </CardHeader>
            {open && (
                <CardContent className="space-y-4">
                    <Rows label="connections" rows={rows.connections} />
                    <Rows label="groups" rows={rows.groups} />
                    <AttributeList attrs={rows.other} />

                    {rows.vocabulary.length > 0 && (
                        <div className="space-y-2 border-t pt-3">
                            <p className="text-xs font-medium">
                                What your rules can match on
                            </p>
                            {rows.vocabulary.map(entry => (
                                <div key={entry.key} className="space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-mono text-bart-key">
                                            {entry.key}
                                        </span>
                                        : {entry.description}
                                    </p>
                                    <BartCode source={entry.example} />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
