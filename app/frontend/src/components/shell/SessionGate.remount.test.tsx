import { SessionGate } from '@/components/shell/SessionGate';
import { SessionProvider, useSession } from '@/lib/session/SessionProvider';
import { render, screen, userEvent } from '@/test/render';
import { server, usersHandler } from '@/test/server';
import { alice, bob } from '@/test/users';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Split from SessionGate.test.tsx because `vi.mock` is per-file: that suite
// needs `useRouter` and a mutable pathname too, this one needs neither.
vi.mock('next/navigation', () => ({ usePathname: () => '/resources' }));

/** Stands in for a screen holding an unsaved draft, which is exactly what must
 *  not survive an identity change. */
function DraftingScreen() {
    const [draft, setDraft] = useState('');
    return (
        <input
            aria-label="Draft"
            value={draft}
            onChange={e => setDraft(e.target.value)}
        />
    );
}

function Switcher() {
    const { switchTo } = useSession();
    return <button onClick={() => switchTo(bob.id)}>Become bob</button>;
}

describe('SessionGate on a user switch', () => {
    beforeEach(() => {
        server.use(usersHandler([alice, bob]));
    });

    it('drops a screen-local draft, because the key remounts every child', async () => {
        render(
            <SessionProvider>
                <Switcher />
                <SessionGate>
                    <DraftingScreen />
                </SessionGate>
            </SessionProvider>,
        );

        const draft = await screen.findByRole('textbox', { name: 'Draft' });
        await userEvent.type(draft, 'unsaved work');
        expect(draft).toHaveValue('unsaved work');

        await userEvent.click(
            screen.getByRole('button', { name: 'Become bob' }),
        );

        expect(
            await screen.findByRole('textbox', { name: 'Draft' }),
        ).toHaveValue('');
    });
});
