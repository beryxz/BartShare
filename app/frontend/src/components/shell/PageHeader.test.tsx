import { PageHeader } from '@/components/shell/PageHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { render, screen } from '@/test/render';
import { describe, expect, it } from 'vitest';

// `SidebarTrigger` calls `useSidebar`, which throws without this provider.
function renderHeader(ui: React.ReactElement) {
    return render(<SidebarProvider>{ui}</SidebarProvider>);
}

describe('PageHeader', () => {
    it('renders the title as the page heading', () => {
        renderHeader(<PageHeader title="Resources" />);
        expect(
            screen.getByRole('heading', { level: 1, name: 'Resources' }),
        ).toBeInTheDocument();
    });

    it('omits the description when not given one', () => {
        const { container } = renderHeader(<PageHeader title="Resources" />);
        expect(container.querySelector('p')).toBeNull();
    });

    it('omits the action slot when not given one', () => {
        renderHeader(<PageHeader title="Resources" />);
        expect(
            screen.queryByRole('button', { name: 'New resource' }),
        ).not.toBeInTheDocument();
    });

    it('renders the description and the actions when given them', () => {
        renderHeader(
            <PageHeader
                title="Resources"
                description="Things you own."
                actions={<button>New resource</button>}
            />,
        );
        expect(screen.getByText('Things you own.')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'New resource' }),
        ).toBeInTheDocument();
    });
});
