import { SessionGate } from '@/components/shell/SessionGate';
import { SessionProvider } from '@/lib/session/SessionProvider';
import { server } from '@/test/server';
import { renderWithSession } from '@/test/session';
import { render, screen } from '@/test/render';
import { alice } from '@/test/users';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pathname } = vi.hoisted(() => ({
    pathname: { current: '/resources' },
}));

vi.mock('next/navigation', () => ({
    usePathname: () => pathname.current,
    // ScenarioPicker calls useRouter unconditionally, for the first-run cases.
    useRouter: () => ({ push: () => {} }),
}));

describe('SessionGate', () => {
    beforeEach(() => {
        pathname.current = '/resources';
    });

    it('renders children once an acting user resolves', async () => {
        renderWithSession(<SessionGate>content</SessionGate>, {
            users: [alice],
        });
        expect(await screen.findByText('content')).toBeInTheDocument();
    });

    it('hands off to the first-run screen on an empty database', async () => {
        renderWithSession(<SessionGate>content</SessionGate>, { users: [] });
        await screen.findByRole('heading', { name: 'Nothing here yet' });
        expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('renders /debug/log through the gate, on an empty database', async () => {
        pathname.current = '/debug/log';
        renderWithSession(<SessionGate>content</SessionGate>, { users: [] });
        expect(await screen.findByText('content')).toBeInTheDocument();
    });

    it('renders /debug/status and /debug/api through the gate too', async () => {
        for (const path of ['/debug/status', '/debug/api']) {
            pathname.current = path;
            const { unmount } = renderWithSession(
                <SessionGate>content</SessionGate>,
                { users: [] },
            );
            expect(await screen.findByText('content')).toBeInTheDocument();
            unmount();
        }
    });

    it('keeps /debug itself gated, so its first-run handoff survives', async () => {
        pathname.current = '/debug';
        renderWithSession(<SessionGate>content</SessionGate>, { users: [] });
        await screen.findByRole('heading', { name: 'Nothing here yet' });
        expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('shows the error state, not the first-run screen, when the user list fails', async () => {
        // Not `renderWithSession`: it registers its own `usersHandler`.
        server.use(
            http.get('*/api/v1/users', () =>
                HttpResponse.json({ errors: ['db down'] }, { status: 503 }),
            ),
        );
        render(
            <SessionProvider>
                <SessionGate>content</SessionGate>
            </SessionProvider>,
        );
        expect(
            await screen.findByText('Evaluator unavailable'),
        ).toBeInTheDocument();
    });
});
