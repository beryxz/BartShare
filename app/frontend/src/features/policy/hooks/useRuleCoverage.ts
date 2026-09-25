'use client';

import { fetchRuleCoverage } from '@/features/resources/api';
import { swrKey } from '@/lib/api/keys';
import { RuleCoverageEntry } from '@/lib/api/types';
import { PolicyRule } from '@/lib/bart/rule';
import { useSession } from '@/lib/session/SessionProvider';
import useSWR from 'swr';

/**
 * Coverage counts for a rule list, computed server-side over the caller's
 * COMPLETE resource set.
 *
 * A rule with no `pattern` failed to parse at all and contributes nothing, so
 * `coverage[i]` pairs with the i-th SENT pattern, not the i-th rule.
 */
export function useRuleCoverage(rules: PolicyRule[]) {
    const { actingUser } = useSession();
    const sent = rules.filter(rule => rule.pattern !== null);
    const patterns = sent.map(rule => rule.pattern!);

    // Gated on `rules`, not `patterns`: with every rule unreadable
    // `patterns` is empty, but the server's `total` is right and still wanted.
    const swr = useSWR(
        rules.length === 0
            ? null
            : swrKey(actingUser?.id ?? null, '/me/rules/coverage', {
                  patterns: JSON.stringify(patterns),
              }),
        () => fetchRuleCoverage(patterns),
    );

    // Map back from "index among sent patterns" to "rule id", so a caller can
    // look up by rule without re-deriving which rules were skipped.
    const byRuleId = new Map<string, RuleCoverageEntry>();
    sent.forEach((rule, i) => {
        const entry = swr.data?.coverage[i];
        if (entry) byRuleId.set(rule.id, entry);
    });

    return {
        total: swr.data?.total ?? 0,
        byRuleId,
        isLoading: swr.isLoading,
    };
}
