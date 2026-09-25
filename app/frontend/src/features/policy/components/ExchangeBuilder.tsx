'use client';

import { AttributeEditor } from '@/components/bart/AttributeEditor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAttrVocabulary } from '@/hooks/use-attr-vocabulary';
import {
    ExchangeGroup,
    ExchangeTerm,
    normalizeExchange,
} from '@/lib/bart/rule';
import { useState } from 'react';
import { ParticipantPicker } from './ParticipantPicker';

const NEW_TERM: ExchangeTerm = {
    to: { kind: 'me' },
    resource: {},
    from: { kind: 'requester' },
};

/**
 * Synthetic term identity, for React reconciliation only; `ExchangeTerm` has
 * none. Not a `useRef`: `react-hooks/refs` forbids the render-time read.
 */
let nextTermSeq = 0;
function newTermId(): string {
    return `term-${nextTermSeq++}`;
}

/**
 * The exchange half of a rule. Flat: one connector over a list, a mixed
 * `and`/`or` tree never reaching here, `parseRule` having reported it
 * unrepresentable; a lone term always carries `connector: 'and'`, hence no
 * control at one term. `termIds` is a parallel array of synthetic ids:
 * `ExchangeTerm` cannot carry one without breaking `parseRule`'s fixed point,
 * and an index key would let per-row state follow the slot, not the term.
 */
export function ExchangeBuilder({
    exchange,
    onChange,
    onValidityChange,
}: {
    exchange: ExchangeGroup | undefined;
    onChange: (next: ExchangeGroup | undefined) => void;
    /**
     * Reports one of this component's attribute editors as parseable or not,
     * under an id unique to it, so `SimpleRuleEditor` can aggregate a dynamic
     * set of them into the one boolean Save is gated on. Composed here and
     * nowhere else (`${termId}:resource`, `:to`, `:from`) on the synthetic
     * term id, since an array index shifts when a term is removed.
     */
    onValidityChange?: (id: string, valid: boolean) => void;
}) {
    // Hooks run unconditionally, ahead of the no-exchange early return. Seeded
    // from `exchange`, so a rule with terms already starts with one id each.
    const [termIds, setTermIds] = useState<string[]>(() =>
        (exchange?.terms ?? []).map(newTermId),
    );
    const vocabulary = useAttrVocabulary('other-resources');

    if (!exchange)
        return (
            <div className="space-y-1.5">
                <Label>Exchange</Label>
                <p className="text-xs text-muted-foreground">
                    Nothing asked in return: this rule grants outright.
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setTermIds([newTermId()]);
                        onChange({ connector: 'and', terms: [NEW_TERM] });
                    }}
                >
                    Ask for something in exchange
                </Button>
            </div>
        );

    function update(next: ExchangeGroup) {
        onChange(normalizeExchange(next));
    }

    function updateTerm(index: number, term: ExchangeTerm) {
        update({
            ...exchange!,
            terms: exchange!.terms.map((t, i) => (i === index ? term : t)),
        });
    }

    function addTerm() {
        setTermIds(ids => [...ids, newTermId()]);
        update({ ...exchange!, terms: [...exchange!.terms, NEW_TERM] });
    }

    function removeTerm(index: number) {
        // A removed term can no longer be corrected, so retract its three
        // editors: otherwise an unparseable value latches Save shut with
        // nothing left on screen to fix.
        const termId = termIds[index];
        onValidityChange?.(`${termId}:resource`, true);
        onValidityChange?.(`${termId}:to`, true);
        onValidityChange?.(`${termId}:from`, true);

        const terms = exchange!.terms.filter((_, i) => i !== index);
        setTermIds(ids => ids.filter((_, i) => i !== index));
        // The last term out means there is no exchange, not an empty one:
        // `exchange:()` is not a thing the grammar has.
        onChange(
            terms.length === 0
                ? undefined
                : normalizeExchange({ ...exchange!, terms }),
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <Label>Exchange</Label>
                {exchange.terms.length > 1 && (
                    <Select
                        value={exchange.connector}
                        onValueChange={connector =>
                            update({
                                ...exchange,
                                connector: connector as 'and' | 'or',
                            })
                        }
                    >
                        <SelectTrigger
                            size="sm"
                            className="w-40 shrink-0 text-xs"
                            aria-label="How the exchange terms combine"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="and">all of these</SelectItem>
                            <SelectItem value="or">any one of these</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>

            {exchange.terms.map((term, index) => (
                <div
                    key={termIds[index]}
                    className="space-y-2 rounded-lg border p-3"
                >
                    <div className="flex items-center gap-2">
                        {/* Not `font-mono`: monospace here means a literal
                            `.bart` keyword, which this label is not. */}
                        <span className="text-xs font-medium text-muted-foreground">
                            Term {index + 1}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto"
                            onClick={() => removeTerm(index)}
                        >
                            Remove
                        </Button>
                    </div>

                    <ParticipantPicker
                        side="to"
                        value={term.to}
                        onChange={to => updateTerm(index, { ...term, to })}
                        onValidityChange={valid =>
                            onValidityChange?.(`${termIds[index]}:to`, valid)
                        }
                    />

                    <div className="space-y-1.5">
                        <Label className="font-mono text-xs">resource</Label>
                        <AttributeEditor
                            attrs={term.resource}
                            onChange={resource =>
                                updateTerm(index, { ...term, resource })
                            }
                            onValidityChange={valid =>
                                onValidityChange?.(
                                    `${termIds[index]}:resource`,
                                    valid,
                                )
                            }
                            vocabulary={vocabulary}
                        />
                        {/* A hint, not an error: adding the term created
                            this state. `simpleReady` is what blocks Save. */}
                        {Object.keys(term.resource).length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                Add at least one attribute to complete this
                                term.
                            </p>
                        )}
                    </div>

                    <ParticipantPicker
                        side="from"
                        value={term.from}
                        onChange={from => updateTerm(index, { ...term, from })}
                        onValidityChange={valid =>
                            onValidityChange?.(`${termIds[index]}:from`, valid)
                        }
                    />
                </div>
            ))}

            <Button variant="outline" size="sm" onClick={addTerm}>
                Add term
            </Button>
        </div>
    );
}
