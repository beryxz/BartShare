'use client';

import { EmptyState } from '@/components/states/EmptyState';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { toastWriteError } from '@/lib/toast';
import { PolicyRule } from '@/lib/bart/rule';
import { useState } from 'react';
import { useRuleCoverage } from '../hooks/useRuleCoverage';
import { RuleCard } from './RuleCard';
import { RuleEditorSheet } from './RuleEditorSheet';

export function RulesList({
    rules,
    onSave,
}: {
    rules: PolicyRule[];
    onSave: (next: PolicyRule[]) => Promise<void>;
}) {
    const { total, byRuleId } = useRuleCoverage(rules);
    const [editing, setEditing] = useState<PolicyRule | null>(null);
    const [open, setOpen] = useState(false);
    // Bumped on every open so the sheet remounts with fresh state. Keying on
    // the rule id would not: reopening the SAME rule keeps its old draft.
    const [openToken, setOpenToken] = useState(0);
    // Card-level, not per-row: a rule id is its position in a bare `string[]`,
    // so a write renumbers every later row, which no per-row flag can see.
    const [busy, setBusy] = useState(false);

    function openEditor(rule: PolicyRule | null) {
        setEditing(rule);
        setOpenToken(token => token + 1);
        setOpen(true);
    }

    // Deliberately no catch: the sheet awaits this and renders the failure
    // where the offending text is.
    async function save(rule: PolicyRule) {
        setBusy(true);
        try {
            const exists = rules.some(r => r.id === rule.id);
            await onSave(
                exists
                    ? rules.map(r => (r.id === rule.id ? rule : r))
                    : [...rules, rule],
            );
        } finally {
            setBusy(false);
        }
    }

    // Toasted rather than inline: the row being deleted is gone from the DOM by
    // the time an error could render beside it.
    async function destroy(rule: PolicyRule) {
        setBusy(true);
        try {
            await onSave(rules.filter(r => r.id !== rule.id));
        } catch (error) {
            toastWriteError(error);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Rules</CardTitle>
                <CardDescription>
                    Tried in order; the first matching rule decides. A rule with
                    no matching alternative is a deny.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {rules.length === 0 ? (
                    <EmptyState
                        title="No rules"
                        description="You share nothing yet. A party with no rules can still request from others."
                    />
                ) : (
                    rules.map((rule, i) => (
                        <RuleCard
                            key={rule.id}
                            rule={rule}
                            index={i}
                            entry={byRuleId.get(rule.id)}
                            total={total}
                            busy={busy}
                            onEdit={() => openEditor(rule)}
                            onDelete={() => destroy(rule)}
                        />
                    ))
                )}

                <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => openEditor(null)}
                >
                    Add rule
                </Button>
            </CardContent>

            <RuleEditorSheet
                key={openToken}
                rule={editing}
                open={open}
                onOpenChange={setOpen}
                onSave={save}
            />
        </Card>
    );
}
