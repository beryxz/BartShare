'use client';

import { AttributeEditor } from '@/components/bart/AttributeEditor';
import { PartyPicker } from '@/components/bart/PartyPicker';
import { PageHeader } from '@/components/shell/PageHeader';
import { FormErrors } from '@/components/states/FormErrors';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAttrVocabulary } from '@/hooks/use-attr-vocabulary';
import { errorMessages } from '@/lib/api/errors';
import { AccessResult } from '@/lib/api/types';
import { BartAttrs } from '@/lib/bart/types';
import { useState } from 'react';
import { customRequest } from './api';
import { TraceViewer } from './TraceViewer';

/**
 * The one screen that composes a request instead of deriving it from a row: the
 * row path always sends a resource's *full* attrs against
 * `from:(any:(userId:<owner>))`, while here both halves are open.
 *
 * A permit here describes a resource *description*, not a row, so there is
 * nothing to download and no Open action.
 */
export function RequestBuilderPage() {
    const [resource, setResource] = useState<BartAttrs>({});
    const [quantifier, setQuantifier] = useState<'any' | 'all'>('any');
    const [from, setFrom] = useState<BartAttrs>({});
    const [result, setResult] = useState<AccessResult | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [pending, setPending] = useState(false);
    // A row that does not parse never reaches `onChange`, so without this the
    // page would evaluate the last value that DID parse.
    const [resourceValid, setResourceValid] = useState(true);
    const [fromValid, setFromValid] = useState(true);
    const resourceVocabulary = useAttrVocabulary('other-resources');
    const partyVocabulary = useAttrVocabulary('parties');

    const wildcard = Object.keys(resource).length === 0;

    // The errors and the verdict card both describe the attributes as sent,
    // so any edit makes them stale: clear both now, not at the next submit.
    function edited<T>(apply: (value: T) => void) {
        return (value: T) => {
            setErrors([]);
            setResult(null);
            apply(value);
        };
    }

    async function submit() {
        setPending(true);
        setErrors([]);
        setResult(null);
        try {
            setResult(
                await customRequest({
                    resource,
                    from: { quantifier, attrs: from },
                }),
            );
        } catch (error) {
            setErrors(errorMessages(error));
        } finally {
            setPending(false);
        }
    }

    return (
        <>
            <PageHeader
                title="Request builder"
                description="Ask the engine about a resource description rather than a row. Nothing is stored: every submission re-evaluates."
            />

            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Resource pattern</CardTitle>
                        <CardDescription>
                            The attributes the request asks for. The engine
                            matches request ⊆ rule, so a coarser pattern matches
                            more rules, not fewer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <AttributeEditor
                            attrs={resource}
                            onChange={edited(setResource)}
                            onValidityChange={setResourceValid}
                            vocabulary={resourceVocabulary}
                        />
                        {wildcard && (
                            <p className="text-xs text-muted-foreground">
                                An empty pattern is Bart&apos;s wildcard: it
                                matches everything, so the backend rejects it
                                rather than permit anything at all. Name at
                                least one attribute.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>From which parties</CardTitle>
                        <CardDescription>
                            <code className="font-mono">any</code> permits if
                            one matching party grants it;{' '}
                            <code className="font-mono">all</code> requires
                            every matching party to.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="quantifier">Quantifier</Label>
                            <Select
                                value={quantifier}
                                onValueChange={edited(value =>
                                    setQuantifier(value as 'any' | 'all'),
                                )}
                            >
                                <SelectTrigger
                                    id="quantifier"
                                    className="w-32 font-mono"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="any">any</SelectItem>
                                    <SelectItem value="all">all</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <Label>Party pattern</Label>
                                {/* Through `edited`, so a pick invalidates the
                                    verdict card the way a keystroke does. */}
                                <PartyPicker
                                    onPick={edited((userId: string) =>
                                        setFrom({ ...from, userId }),
                                    )}
                                />
                            </div>
                            {/* `userId` is reserved, opted into here: it is
                                what a policy compares. */}
                            <AttributeEditor
                                attrs={from}
                                onChange={edited(setFrom)}
                                onValidityChange={setFromValid}
                                allowReserved={['userId']}
                                vocabulary={partyVocabulary}
                            />
                            <p className="text-xs text-muted-foreground">
                                Empty means any party at all: the grammar allows
                                zero attributes here.{' '}
                                <span className="font-medium">
                                    Name a party…
                                </span>{' '}
                                fills in the{' '}
                                <code className="font-mono">userId</code> that
                                targets exactly one.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <FormErrors errors={errors} />
                {(!resourceValid || !fromValid) && (
                    <p className="text-xs text-verdict-deny-fg">
                        Fix the highlighted attribute first
                    </p>
                )}

                <Button
                    disabled={
                        wildcard || pending || !resourceValid || !fromValid
                    }
                    onClick={submit}
                >
                    {pending ? 'Evaluating…' : 'Evaluate request'}
                </Button>

                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Result</CardTitle>
                            <CardDescription>
                                A permit here is a claim about a resource
                                description, not about any particular row; there
                                is nothing to download.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TraceViewer result={result} />
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
