import { describe, expect, it } from 'vitest';
import { validateAttrKey } from './types';

describe('validateAttrKey', () => {
    it('accepts a plain name', () => {
        expect(validateAttrKey('course')).toBeNull();
        expect(validateAttrKey('_private9')).toBeNull();
    });

    it('rejects names the grammar cannot lex', () => {
        expect(validateAttrKey('9lives')).toBe('invalid-name');
        expect(validateAttrKey('has-dash')).toBe('invalid-name');
        expect(validateAttrKey('has.dot')).toBe('invalid-name');
        expect(validateAttrKey('')).toBe('invalid-name');
    });

    it('rejects Bart keywords, which lex as literal tokens', () => {
        expect(validateAttrKey('to')).toBe('keyword');
        expect(validateAttrKey('resource')).toBe('keyword');
        expect(validateAttrKey('any')).toBe('keyword');
    });

    it('rejects keys owned by the backend or its context providers', () => {
        expect(validateAttrKey('userId')).toBe('reserved');
        expect(validateAttrKey('connections')).toBe('reserved');
        expect(validateAttrKey('date_year')).toBe('reserved');
    });

    it('accepts a reserved key that is explicitly allowed', () => {
        // POST /resources/access permits userId in the party pattern: naming
        // one party by id is what the key is for.
        expect(validateAttrKey('userId', ['userId'])).toBeNull();
    });

    it('still rejects a reserved key that is not in the allow list', () => {
        expect(validateAttrKey('connections', ['userId'])).toBe('reserved');
    });

    it('does not let the allow list override a grammar keyword', () => {
        // The allow list relaxes reservation only. A keyword is unusable as a
        // name at the lexer level, so no endpoint can accept one.
        expect(validateAttrKey('from', ['from'])).toBe('keyword');
    });
});
