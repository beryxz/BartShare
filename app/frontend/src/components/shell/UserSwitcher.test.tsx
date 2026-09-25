import { UserSwitcher } from '@/components/shell/UserSwitcher';
import { screen, userEvent } from '@/test/render';
import { renderWithSession } from '@/test/session';
import { alice, bob } from '@/test/users';
import { describe, expect, it } from 'vitest';

describe('UserSwitcher', () => {
    it('keeps the new-user dialog mounted after the popover closes', async () => {
        renderWithSession(<UserSwitcher />, { users: [alice, bob] });

        await userEvent.click(
            await screen.findByRole('button', { name: /alice/ }),
        );
        await userEvent.click(
            await screen.findByRole('button', { name: 'New user…' }),
        );

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('offers the new-user action with an empty user list, where it is the only way forward', async () => {
        renderWithSession(<UserSwitcher />, { users: [] });

        await userEvent.click(
            await screen.findByRole('button', { name: /No user/ }),
        );
        expect(
            await screen.findByRole('button', { name: 'New user…' }),
        ).toBeInTheDocument();
    });

    it('switches to the selected user', async () => {
        renderWithSession(<UserSwitcher />, { users: [alice, bob] });

        await userEvent.click(
            await screen.findByRole('button', { name: /alice/ }),
        );
        await userEvent.click(
            await screen.findByRole('option', { name: /bob/ }),
        );

        expect(
            await screen.findByRole('button', { name: /bob/ }),
        ).toBeInTheDocument();
    });
});
