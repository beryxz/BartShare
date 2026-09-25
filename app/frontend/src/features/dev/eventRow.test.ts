import { describe, expect, it } from 'vitest';
import { eventDataPreview, eventUserLabel } from './eventRow';

describe('eventUserLabel', () => {
    it('calls a row with no user id a system event', () => {
        expect(eventUserLabel(null, null)).toEqual({
            label: 'system',
            kind: 'system',
        });
    });

    it('shows the username when the party still exists', () => {
        expect(eventUserLabel('u1', 'alice')).toEqual({
            label: 'alice',
            kind: 'user',
        });
    });

    it('falls back to the raw id when the name could not be resolved', () => {
        const result = eventUserLabel('0123456789abcdef', null);
        expect(result.kind).toBe('unresolved');
        expect(result.label).toContain('01234567');
    });

    it('does not pass an unresolved party off as a system event', () => {
        expect(eventUserLabel('u1', null).kind).not.toBe('system');
    });
});

describe('eventDataPreview', () => {
    it('is empty for a null payload', () => {
        expect(eventDataPreview(null)).toBe('');
    });

    it('is one line of JSON for a payload', () => {
        expect(eventDataPreview({ permitted: true, parties: [1, 2] })).toBe(
            '{"permitted":true,"parties":[1,2]}',
        );
    });
});
