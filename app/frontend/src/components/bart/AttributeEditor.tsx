'use client';

import { AttrValueInput } from '@/components/bart/AttrValueInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ATTR_KINDS,
    AttrKind,
    kindOf,
    labelFor,
    parseAttrValue,
    placeholderFor,
    toText,
} from '@/lib/bart/attrValue';
import { AttrKeyProblem, BartAttrs, validateAttrKey } from '@/lib/bart/types';
import {
    AttrVocabulary,
    keySuggestions,
    valueSuggestions,
} from '@/lib/bart/vocabulary';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { useId, useState } from 'react';

const PROBLEM_MESSAGES: Record<AttrKeyProblem, string> = {
    'invalid-name':
        'Names must start with a letter or underscore and contain only letters, digits and underscores.',
    keyword:
        'This word is a Bart keyword, so the grammar cannot read it as a name.',
    reserved:
        'This key is set for you: either by the backend, or by a context provider from your connections, groups and the clock.',
};

/** One attribute line: four columns from @xl (10rem key / 12.5rem kind /
 *  flexible value / auto action); 12.5rem fits the longest kind label at
 *  rest, so @xl never truncates. Below @xl, two rows with the value on its
 *  own line and a key floor so it can't shrink under the kind select, still
 *  at the narrower 9rem kind track (relies on the trigger's ellipsis).
 *  Below @2xs, kind drops to a third row of its own. */
const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 [grid-template-areas:'key_action'_'kind_kind'_'value_value'] @2xs:grid-cols-[minmax(4rem,1fr)_9rem_auto] @2xs:[grid-template-areas:'key_kind_action'_'value_value_value'] @xl:grid-cols-[10rem_12.5rem_minmax(0,1fr)_auto] @xl:[grid-template-areas:'key_kind_value_action']";

/** Ties a stacked block's lines to one attribute; invisible when wide. */
const ROW_BLOCK = 'space-y-1 @max-xl:border-l-2 @max-xl:pl-3';

/** Edits an attribute bag. A refused key says why it is unavailable, which is
 *  where the party-vs-context distinction gets across. */
export function AttributeEditor({
    attrs,
    onChange,
    onValidityChange,
    allowReserved,
    vocabulary,
}: {
    attrs: BartAttrs;
    onChange: (next: BartAttrs) => void;
    /**
     * Fired whenever the set of per-row parse errors becomes empty or stops
     * being empty. Event-driven rather than an effect over `errors`, since
     * this codebase avoids prop-sync effects. Covers committed rows only:
     * the unadded new-attribute draft is not part of `attrs` and the Add
     * button already gates it, so a half-typed new row cannot block saving
     * the rest.
     */
    onValidityChange?: (valid: boolean) => void;
    /** Reserved keys this particular editor's endpoint accepts. */
    allowReserved?: readonly string[];
    /** Observed keys and values to suggest, or undefined for none. Hints, never
     *  an allowlist. */
    vocabulary?: AttrVocabulary;
}) {
    const [newKey, setNewKey] = useState('');
    const [newKind, setNewKind] = useState<AttrKind>('text');
    const [newValueText, setNewValueText] = useState('');

    const ids = useId();
    const keyListId = `${ids}-keys`;
    const keyOptions = keySuggestions(vocabulary ?? [], attrs);

    // Per-key drafts: text, kind, and parse error, none derivable from `attrs`.
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [kinds, setKinds] = useState<Record<string, AttrKind>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    // One seam, so no transition can update `errors` without reporting it.
    function writeErrors(next: Record<string, string>) {
        setErrors(next);
        onValidityChange?.(Object.keys(next).length === 0);
    }

    const problem =
        newKey === '' ? null : validateAttrKey(newKey, allowReserved);
    const duplicate = newKey !== '' && newKey in attrs;
    const newValueResult = parseAttrValue(newValueText, newKind);
    const canAdd = newKey !== '' && !problem && !duplicate && newValueResult.ok;

    function add() {
        if (!canAdd || !newValueResult.ok) return;
        onChange({ ...attrs, [newKey]: newValueResult.value });
        setNewKey('');
        setNewValueText('');
        // `newKind` persists, so several number attributes in a row take one
        // pick rather than one each.
    }

    function remove(key: string) {
        const next = { ...attrs };
        delete next[key];
        onChange(next);

        // Drop this key's draft too, or a later attribute added under the same
        // key inherits it.
        setEdits(prev => omit(prev, key));
        setKinds(prev => omit(prev, key));
        writeErrors(omit(errors, key));
    }

    /** Re-parses `text` under `kind`, writing through to `attrs` only on success. */
    function update(key: string, text: string, kind: AttrKind) {
        setEdits(prev => ({ ...prev, [key]: text }));
        setKinds(prev => ({ ...prev, [key]: kind }));

        const result = parseAttrValue(text, kind);
        if (result.ok) {
            writeErrors(omit(errors, key));
            onChange({ ...attrs, [key]: result.value });
        } else {
            writeErrors({ ...errors, [key]: result.error });
        }
    }

    return (
        <div className="@container">
            <div className="space-y-2 @max-xl:space-y-4">
                {Object.entries(attrs).map(([key, value]) => {
                    const kind = kinds[key] ?? kindOf(value);
                    const text = edits[key] ?? toText(value);
                    const error = errors[key];
                    const valueListId = `${ids}-v-${key}`;
                    const valueOptions = valueSuggestions(
                        vocabulary ?? [],
                        key,
                        kind,
                    );

                    return (
                        <div key={key} className={ROW_BLOCK}>
                            {/* First, not last: space-y-1 margins every child but the last, so this hidden datalist takes it instead of the visible grid below. */}
                            <Suggestions
                                id={valueListId}
                                options={valueOptions}
                            />
                            <div className={ROW_GRID}>
                                <Input
                                    readOnly
                                    value={key}
                                    className="font-mono text-xs [grid-area:key]"
                                />
                                <Select
                                    value={kind}
                                    onValueChange={nextKind =>
                                        update(key, text, nextKind as AttrKind)
                                    }
                                >
                                    <SelectTrigger
                                        size="sm"
                                        className="w-full min-w-0 font-mono text-xs [grid-area:kind] *:data-[slot=select-value]:min-w-0"
                                        aria-label={`Value kind for ${key}`}
                                    >
                                        {/* Radix drops SelectValue's className, so the truncating child is explicit. */}
                                        <SelectValue>
                                            <span className="min-w-0 truncate">
                                                {labelFor(kind)}
                                            </span>
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ATTR_KINDS.map(option => (
                                            <SelectItem
                                                key={option.kind}
                                                value={option.kind}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <AttrValueInput
                                    text={text}
                                    kind={kind}
                                    placeholder={placeholderFor(kind)}
                                    listId={valueListId}
                                    className="font-mono text-xs [grid-area:value]"
                                    ariaLabel={`Value for ${key}`}
                                    onChange={next => update(key, next, kind)}
                                />
                                {/* Icon, not text: "Remove" wrapped onto its own line.
                                    `aria-label` is the accessible name. */}
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="justify-self-end text-destructive hover:text-destructive [grid-area:action]"
                                    aria-label={`Remove ${key}`}
                                    onClick={() => remove(key)}
                                >
                                    <XIcon />
                                </Button>
                            </div>
                            {error && (
                                <p className="text-xs text-verdict-deny-fg">
                                    {error}
                                </p>
                            )}
                        </div>
                    );
                })}

                <div className={cn(ROW_BLOCK, 'border-t pt-2')}>
                    <div className={ROW_GRID}>
                        <Input
                            placeholder="key"
                            value={newKey}
                            list={keyListId}
                            className="font-mono text-xs [grid-area:key]"
                            onChange={e => setNewKey(e.target.value)}
                        />
                        <Select
                            value={newKind}
                            onValueChange={value =>
                                setNewKind(value as AttrKind)
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                className="w-full min-w-0 font-mono text-xs [grid-area:kind] *:data-[slot=select-value]:min-w-0"
                                aria-label="Value kind for new attribute"
                            >
                                <SelectValue>
                                    <span className="min-w-0 truncate">
                                        {labelFor(newKind)}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {ATTR_KINDS.map(option => (
                                    <SelectItem
                                        key={option.kind}
                                        value={option.kind}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <AttrValueInput
                            text={newValueText}
                            kind={newKind}
                            placeholder={placeholderFor(newKind)}
                            listId={`${ids}-new-values`}
                            className="font-mono text-xs [grid-area:value]"
                            ariaLabel="Value for new attribute"
                            onChange={setNewValueText}
                        />
                        <Button
                            size="sm"
                            className="justify-self-end [grid-area:action]"
                            disabled={!canAdd}
                            onClick={add}
                        >
                            Add
                        </Button>
                    </div>
                    <Suggestions id={keyListId} options={keyOptions} />
                    <Suggestions
                        id={`${ids}-new-values`}
                        options={valueSuggestions(
                            vocabulary ?? [],
                            newKey,
                            newKind,
                        )}
                    />
                    {!newValueResult.ok && newValueText !== '' && (
                        <p className="text-xs text-verdict-deny-fg">
                            {newValueResult.error}
                        </p>
                    )}
                    {problem && (
                        <p className="text-xs text-verdict-deny-fg">
                            {PROBLEM_MESSAGES[problem]}
                        </p>
                    )}
                    {duplicate && (
                        <p className="text-xs text-verdict-deny-fg">
                            This attribute already exists. Bart rejects
                            duplicate keys.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Shallow-copies `record` without `key`: used to drop a removed row's local state. */
function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
    const next = { ...record };
    delete next[key];
    return next;
}

/** A `<datalist>`, or nothing when there is nothing to suggest. An empty one
 *  renders a dropdown affordance in some browsers. */
function Suggestions({ id, options }: { id: string; options: string[] }) {
    if (options.length === 0) return null;
    return (
        <datalist id={id}>
            {options.map(option => (
                <option key={option} value={option} />
            ))}
        </datalist>
    );
}
