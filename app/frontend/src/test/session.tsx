import { SessionProvider } from '@/lib/session/SessionProvider';
import type { ApiUser } from '@/lib/api/types';
import { render } from '@/test/render';
import type { ReactElement } from 'react';
import { server, usersHandler } from './server';

/**
 * Renders `ui` behind a real `SessionProvider`, with `GET /users` answering
 * the given users. Does not mock `next/navigation`: `vi.mock` is hoisted, so
 * it only works written in the test file itself.
 */
export function renderWithSession(
    ui: ReactElement,
    { users = [] }: { users?: ApiUser[] } = {},
) {
    server.use(usersHandler(users));
    return render(<SessionProvider>{ui}</SessionProvider>);
}
