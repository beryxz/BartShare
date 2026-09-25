import { PartyRef } from '@/components/bart/PartyRef';
import { render, screen } from '@/test/render';
import { alice } from '@/test/users';
import { describe, expect, it } from 'vitest';

describe('PartyRef', () => {
    it('shows the party index when given one', () => {
        render(<PartyRef user={alice} index={2} />);
        expect(screen.getByText('party #2')).toBeInTheDocument();
    });

    it('omits the index entirely when not given one', () => {
        render(<PartyRef user={alice} />);
        expect(screen.queryByText(/party #/)).not.toBeInTheDocument();
    });

    it('renders index 0, since 0 is a real index and not an absent one', () => {
        render(<PartyRef user={alice} index={0} />);
        expect(screen.getByText('party #0')).toBeInTheDocument();
    });
});
