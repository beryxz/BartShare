'use client';

import { AttributeEditor } from '@/components/bart/AttributeEditor';
import { PartyPicker } from '@/components/bart/PartyPicker';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAttrVocabulary } from '@/hooks/use-attr-vocabulary';
import { Participant } from '@/lib/bart/rule';

/**
 * One end of an exchange term.
 *
 * The two ends are not interchangeable: `Bart.g4` gives `to : 'me' | others`
 * and `from : 'requester' | others`, so `to:requester` and `from:me` do not
 * parse. The options offered are the grammar's, hence `side` as a prop.
 *
 * A quantified party opts into `userId` (`allowReserved`), as the request
 * builder does: `userId` is what a policy compares.
 */
export function ParticipantPicker({
    side,
    value,
    onChange,
    onValidityChange,
}: {
    side: 'to' | 'from';
    value: Participant;
    onChange: (next: Participant) => void;
    /**
     * Forwards this picker's party-pattern editor's validity, so Save can be
     * gated on it. A bare boolean, not an id: there is exactly one editor
     * here, and `ExchangeBuilder` knows which term each picker is under.
     */
    onValidityChange?: (valid: boolean) => void;
}) {
    const fixed = side === 'to' ? 'me' : 'requester';
    const quantified = value.kind === 'any' || value.kind === 'all';
    const vocabulary = useAttrVocabulary('parties');

    function pick(kind: string) {
        if (kind === 'any' || kind === 'all') {
            // Carry the pattern across an any/all switch: the quantifier
            // changed, not who is being described.
            onChange({ kind, attrs: quantified ? value.attrs : {} });
            return;
        }
        // `me`/`requester` take no pattern, so the editor below unmounts and
        // its last report can no longer be corrected. An `any`/`all` swap is
        // not this case: that editor stays mounted with its own error state.
        onValidityChange?.(true);
        onChange(kind === 'me' ? { kind: 'me' } : { kind: 'requester' });
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <Label className="w-12 shrink-0 font-mono text-xs">
                    {side}
                </Label>
                <Select value={value.kind} onValueChange={pick}>
                    <SelectTrigger
                        size="sm"
                        className="w-44 shrink-0 font-mono text-xs"
                        aria-label={`Party for ${side}`}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={fixed}>{fixed}</SelectItem>
                        <SelectItem value="any">any party matching…</SelectItem>
                        <SelectItem value="all">
                            all parties matching…
                        </SelectItem>
                    </SelectContent>
                </Select>
                {quantified && (
                    <PartyPicker
                        onPick={userId =>
                            onChange({
                                kind: value.kind as 'any' | 'all',
                                attrs: { ...value.attrs, userId },
                            })
                        }
                    />
                )}
            </div>

            {quantified && (
                <div className="pl-14">
                    <AttributeEditor
                        attrs={value.attrs}
                        allowReserved={['userId']}
                        onChange={attrs =>
                            onChange({
                                kind: value.kind as 'any' | 'all',
                                attrs,
                            })
                        }
                        onValidityChange={onValidityChange}
                        vocabulary={vocabulary}
                    />
                    {Object.keys(value.attrs).length === 0 && (
                        <p className="text-xs text-muted-foreground">
                            No attributes: this matches every party.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
