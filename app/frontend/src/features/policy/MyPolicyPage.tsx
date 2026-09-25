'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { SectionHeading } from '@/components/shell/SectionHeading';
import { ErrorState } from '@/components/states/ErrorState';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { Separator } from '@/components/ui/separator';
import { userName } from '@/lib/bart/naming';
import { DangerZoneCard } from './components/DangerZoneCard';
import { DerivedContextCard } from './components/DerivedContextCard';
import { PartyAttributesCard } from './components/PartyAttributesCard';
import { PolicyPrimer } from './components/PolicyPrimer';
import { RulesList } from './components/RulesList';
import { useMyPolicy } from './hooks/usePolicy';

export function MyPolicyPage() {
    const {
        actingUserId,
        attrs,
        rules,
        saveAttrs,
        saveRules,
        deleteAccount,
        context,
        isLoading,
        error,
        contextError,
    } = useMyPolicy();

    const router = useRouter();
    const params = useSearchParams();
    const wanted = params.get('rule');

    // Fires once: a later /me revalidation would otherwise re-scroll.
    const scrolledRef = useRef(false);

    // Rules render from fetched data, so `rules` in the deps is what makes a
    // later pass find the element. `scrolledRef`, not a cleanup, is what stops
    // the re-fire, so the removal timer is never raced.
    useEffect(() => {
        if (!wanted || scrolledRef.current) return;
        const card = document.getElementById(`rule-${wanted}`);
        if (!card) return;
        scrolledRef.current = true;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('ring-2', 'ring-ring');
        // Clears the param now that the deep link has fired, so it stops
        // being live state a later `rules` identity change can act on.
        router.replace('/policy');
        setTimeout(() => card.classList.remove('ring-2', 'ring-ring'), 2000);
    }, [wanted, rules, router]);

    const header = (
        <PageHeader
            title="My Policy"
            description="You are one party in the policy system: an attribute list and a list of rules."
        />
    );

    // The two reads fail independently: without the policy there is nothing to
    // show, without the context only a diagnostic is missing.
    if (error)
        return (
            <>
                {header}
                <ErrorState error={error} />
            </>
        );

    return (
        <>
            {header}
            {isLoading ? (
                <ListSkeleton />
            ) : (
                <div className="space-y-4">
                    <SectionHeading title="Who you are" />
                    <PartyAttributesCard attrs={attrs} onSave={saveAttrs} />
                    {/* The context is the party's, not the rules': it reports
                        what the evaluator computes for this one party. */}
                    {contextError ? (
                        <ErrorState error={contextError} />
                    ) : (
                        <DerivedContextCard context={context} />
                    )}

                    <SectionHeading title="What you grant" />
                    <RulesList rules={rules} onSave={saveRules} />
                    <PolicyPrimer />

                    {/* Unlabelled, unlike the sections above: a heading would
                        give a destructive action the policy's own weight. */}
                    <Separator className="mt-2 mb-4" />
                    <DangerZoneCard
                        username={
                            actingUserId
                                ? userName({ id: actingUserId, attrs })
                                : 'this user'
                        }
                        onDelete={deleteAccount}
                    />
                </div>
            )}
        </>
    );
}
