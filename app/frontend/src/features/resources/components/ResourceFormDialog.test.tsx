import { ResourceFormDialog } from '@/features/resources/components/ResourceFormDialog';
import { ApiError } from '@/lib/api/client';
import type { ApiResource } from '@/lib/api/types';
import { screen, userEvent } from '@/test/render';
import { renderWithSession } from '@/test/session';
import { describe, expect, it, vi } from 'vitest';

const report: ApiResource = {
    id: 'r-1',
    attrs: { kind: 'report' },
    metadata: { name: 'Q3 report', description: 'Numbers' },
    content: null,
    user: { id: 'u-1' },
};

function renderDialog(
    overrides: Partial<Parameters<typeof ResourceFormDialog>[0]> = {},
) {
    const props = {
        trigger: <button>Open</button>,
        onCreate: vi.fn().mockResolvedValue(report),
        onUpdate: vi.fn().mockResolvedValue(report),
        onUpload: vi.fn().mockResolvedValue(report),
        onClear: vi.fn().mockResolvedValue(report),
        ...overrides,
    };
    return { props, ...renderWithSession(<ResourceFormDialog {...props} />) };
}

describe('ResourceFormDialog', () => {
    it('seeds the fields from the resource each time it opens', async () => {
        renderDialog({ resource: report });

        await userEvent.click(screen.getByRole('button', { name: 'Open' }));
        expect(await screen.findByLabelText('Name *')).toHaveValue('Q3 report');
    });

    it('discards an abandoned draft when the same resource is reopened', async () => {
        renderDialog({ resource: report });

        await userEvent.click(screen.getByRole('button', { name: 'Open' }));
        const name = await screen.findByLabelText('Name *');
        await userEvent.clear(name);
        await userEvent.type(name, 'abandoned edit');
        expect(name).toHaveValue('abandoned edit');

        await userEvent.keyboard('{Escape}');
        await userEvent.click(screen.getByRole('button', { name: 'Open' }));

        expect(await screen.findByLabelText('Name *')).toHaveValue('Q3 report');
    });

    it('opens blank for a new resource', async () => {
        renderDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Open' }));
        expect(await screen.findByLabelText('Name *')).toHaveValue('');
        expect(
            screen.getByRole('heading', { name: 'New resource' }),
        ).toBeInTheDocument();
    });
});

describe('ResourceFormDialog two-phase save', () => {
    it('retries the upload against the row phase one created, never creating a second', async () => {
        const onCreate = vi.fn().mockResolvedValue(report);
        const onUpload = vi
            .fn()
            .mockRejectedValueOnce(new Error('upload failed'))
            .mockResolvedValue(report);
        const { props } = renderDialog({ onCreate, onUpload });

        await userEvent.click(screen.getByRole('button', { name: 'Open' }));
        await userEvent.type(
            await screen.findByLabelText('Name *'),
            'New thing',
        );
        await userEvent.upload(
            screen.getByLabelText('File'),
            new File(['bytes'], 'a.txt', { type: 'text/plain' }),
        );

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText(/did not upload/)).toBeInTheDocument();
        expect(onCreate).toHaveBeenCalledOnce();

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onCreate).toHaveBeenCalledOnce();
        expect(props.onUpdate).toHaveBeenCalledWith(
            report.id,
            expect.objectContaining({
                metadata: expect.objectContaining({ name: 'New thing' }),
            }),
        );
        expect(onUpload).toHaveBeenCalledTimes(2);
    });

    it('translates the backend rejection into the wording the field uses', async () => {
        const onCreate = vi
            .fn()
            .mockRejectedValue(
                new ApiError(400, [
                    "metadata: 'name' is required and must be a non-empty string",
                ]),
            );
        renderDialog({ onCreate });

        await userEvent.click(screen.getByRole('button', { name: 'Open' }));
        await userEvent.click(
            await screen.findByRole('button', { name: 'Save' }),
        );

        expect(await screen.findByText('Name is required')).toBeInTheDocument();
    });
});
