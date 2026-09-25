'use client';

import { AttributeEditor } from '@/components/bart/AttributeEditor';
import { BartCode } from '@/components/bart/BartCode';
import { Label } from '@/components/ui/label';
import { useAttrVocabulary } from '@/hooks/use-attr-vocabulary';
import { useGroupNames } from '@/hooks/use-group-names';
import { useUserNames } from '@/hooks/use-user-names';
import { RuleAst, tryPrintRule } from '@/lib/bart/rule';
import { BartAttrs } from '@/lib/bart/types';
import { useRef, useState } from 'react';
import { usePatternCoverage } from '../hooks/usePatternCoverage';
import { ConditionEditor } from './ConditionEditor';
import { ExchangeBuilder } from './ExchangeBuilder';
import { ResourcePatternPicker } from './ResourcePatternPicker';
import { RuleCoverage } from './RuleCoverage';

/**
 * The block editor: resource pattern, condition, exchange.
 *
 * The live `.bart` preview is literally what will be saved: `tryPrintRule`
 * goes through `printTree`, the one canonical printer. The condition is a
 * syntax-aware field rather than a block builder, and round-trips losslessly
 * because `parseSyntax` captures the span verbatim.
 */
export function SimpleRuleEditor({
    ast,
    onChange,
    onValidityChange,
}: {
    ast: RuleAst;
    onChange: (next: RuleAst) => void;
    /**
     * Whether every attribute editor beneath this one currently holds a
     * parseable value, so the sheet can gate Save on it. `AttributeEditor`
     * writes through to the AST only on a successful parse, so a rejected
     * row leaves the last value that DID parse in `ast` while the row on
     * screen shows an error. The set of editors here is dynamic, so they are
     * aggregated by id below rather than each getting a boolean.
     */
    onValidityChange?: (valid: boolean) => void;
}) {
    // A ref, not state: nothing here renders from it, and the report must go
    // out in the same event, not from an effect. Keyed rather than counted,
    // so a removed exchange term retracts exactly its own ids.
    const invalidEditors = useRef(new Set<string>());

    function reportValidity(id: string, valid: boolean) {
        if (valid) invalidEditors.current.delete(id);
        else invalidEditors.current.add(id);
        onValidityChange?.(invalidEditors.current.size === 0);
    }

    // Bumped on every pick, and passed as the resource `AttributeEditor`'s
    // `key`: forces a fresh mount so its per-key drafts (edits/kinds/errors)
    // don't survive the wholesale replacement `onPick` does underneath it.
    const [resourcePickNonce, setResourcePickNonce] = useState(0);

    function pickResource(resource: BartAttrs) {
        onChange({ ...ast, resource });
        // A picked resource's attrs are already valid, and the remount below
        // reports nothing on its own: retract any stale invalid report so
        // Save can't stay latched off with nothing left on screen to fix.
        reportValidity('resource', true);
        setResourcePickNonce(n => n + 1);
    }

    const names = useUserNames();
    const vocabulary = useAttrVocabulary('my-resources');
    const coverage = usePatternCoverage(ast.resource);
    const printed = tryPrintRule(ast);
    const preview = printed.ok ? printed.text : `# ${printed.message}`;
    const groupNames = useGroupNames(preview);

    return (
        // `divide-y` rather than section cards: `ExchangeBuilder`'s term card
        // stays the only bordered box, so nesting is one level deep.
        <div className="divide-y">
            <section className="space-y-1.5 pb-5">
                <div className="flex items-center justify-between gap-2">
                    <Label>Resource pattern</Label>
                    <ResourcePatternPicker onPick={pickResource} />
                </div>
                <AttributeEditor
                    key={resourcePickNonce}
                    attrs={ast.resource}
                    onChange={resource => onChange({ ...ast, resource })}
                    onValidityChange={valid =>
                        reportValidity('resource', valid)
                    }
                    vocabulary={vocabulary}
                />
                {/* Live, because the count is only useful while the pattern is
                    still being chosen; on the saved card it is a report. */}
                <RuleCoverage
                    entry={coverage.entry}
                    total={coverage.total}
                    hideWhenEmpty
                    emphasis
                />
            </section>

            <section className="space-y-1.5 py-5">
                <Label>Condition</Label>
                <ConditionEditor
                    value={ast.condition ?? ''}
                    onChange={next =>
                        onChange({ ...ast, condition: next || undefined })
                    }
                />
                <p className="text-xs text-muted-foreground">
                    Optional. Example:{' '}
                    <span className="font-mono">
                        requester.userId in connections
                    </span>
                </p>
            </section>

            <section className="py-5">
                <ExchangeBuilder
                    exchange={ast.exchange}
                    onChange={exchange => onChange({ ...ast, exchange })}
                    onValidityChange={reportValidity}
                />
            </section>

            <section className="space-y-1.5 pt-5">
                {/* An output register: the one section the author reads rather
                    than fills in. */}
                <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Preview
                </Label>
                <BartCode
                    source={preview}
                    names={names}
                    groupNames={groupNames}
                />
            </section>
        </div>
    );
}
