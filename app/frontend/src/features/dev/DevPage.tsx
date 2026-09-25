'use client';

import { PageHeader } from '@/components/shell/PageHeader';
import { SectionHeading } from '@/components/shell/SectionHeading';
import { ResetCard } from './components/ResetCard';
import { ScenarioPicker } from './components/ScenarioPicker';

/**
 * Reset first, catalogue second: from here the only action is to wipe, and
 * wiping is what makes the catalogue loadable again on the first-run screen
 * this page hands off to.
 *
 * `SectionHeading` takes only `title`, not a `description` like `PageHeader`
 * above it, hence the plain paragraph under the heading instead of a prop.
 */
export function DevPage() {
    return (
        <div className="space-y-8">
            <PageHeader
                title="Reset & seed"
                description="Reset the database and reload one of the Bart paper's scenarios."
            />

            <ResetCard />

            <section className="space-y-3">
                <SectionHeading title="Scenarios" />
                <p className="text-sm text-muted-foreground">
                    Available to load once the database is empty. Reset above,
                    then pick one on the screen that follows.
                </p>
                <ScenarioPicker readOnly />
            </section>
        </div>
    );
}
