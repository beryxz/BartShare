import { FormErrors } from '@/components/states/FormErrors';
import { render, screen } from '@/test/render';
import { describe, expect, it } from 'vitest';

describe('FormErrors', () => {
    it('renders nothing when there are no errors, so a caller can mount it unconditionally', () => {
        const { container } = render(<FormErrors />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing for an empty list', () => {
        const { container } = render(<FormErrors errors={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders every message, not just the first', () => {
        render(<FormErrors errors={['Name is required', 'Bad attribute']} />);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('renders a repeated message twice, since the backend can send duplicates', () => {
        render(<FormErrors errors={['Same problem', 'Same problem']} />);
        expect(screen.getAllByText('Same problem')).toHaveLength(2);
    });
});
