import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import {
    errorMessages,
    isStaleWriteError,
    staleWriteMessage,
    stripRulePosition,
} from './errors';

describe('errorMessages', () => {
    it('keeps every message an ApiError carries', () => {
        // A 400 names one message per offending key, so flattening to the
        // first would hide the rest of what the user has to fix.
        const error = new ApiError(400, [
            "attrs: key 'to' is a Bart keyword",
            'attrs: key 1x is not a valid name',
        ]);
        expect(errorMessages(error)).toEqual([
            "attrs: key 'to' is a Bart keyword",
            'attrs: key 1x is not a valid name',
        ]);
    });

    it('uses the message of a plain Error', () => {
        expect(errorMessages(new TypeError('Failed to fetch'))).toEqual([
            'Failed to fetch',
        ]);
    });

    it('stringifies anything else', () => {
        expect(errorMessages('boom')).toEqual(['boom']);
    });
});

describe('isStaleWriteError', () => {
    it('is true for a 403, which means the caller is no longer a member', () => {
        // Membership is open and there is no owner, so a 403 on a write is
        // never "you were never allowed"; it is "you left, elsewhere".
        expect(isStaleWriteError(new ApiError(403, ['Not authorized']))).toBe(
            true,
        );
    });

    it('is true for a 404, which means someone else deleted the row', () => {
        expect(isStaleWriteError(new ApiError(404, []))).toBe(true);
    });

    it('is false for a 400, which the user can fix in the form', () => {
        expect(isStaleWriteError(new ApiError(400, ['name is required']))).toBe(
            false,
        );
    });

    it('is false for a 401, which the session gate handles', () => {
        expect(isStaleWriteError(new ApiError(401, []))).toBe(false);
    });

    it('is false for a transport failure with no status at all', () => {
        expect(isStaleWriteError(new TypeError('Failed to fetch'))).toBe(false);
    });

    it('is false for a non-error value', () => {
        expect(isStaleWriteError('403')).toBe(false);
    });
});

describe('staleWriteMessage', () => {
    it('names the race for a 403, rather than echoing "Not authorized"', () => {
        // The backend's own 403 text reads as the user's fault; on a screen
        // with no owner concept it never is: this replaces it.
        expect(staleWriteMessage(new ApiError(403, ['Not authorized']))).toBe(
            'That group changed on the server: the list has been refreshed.',
        );
    });

    it('says the group is gone for a 404', () => {
        expect(staleWriteMessage(new ApiError(404, []))).toBe(
            'That group no longer exists: the list has been refreshed.',
        );
    });
});

describe('stripRulePosition', () => {
    it('drops a document-relative position from a rules error', () => {
        expect(
            stripRulePosition(
                "rules: line 11:37 token recognition error at: '!!'",
            ),
        ).toBe("rules: token recognition error at: '!!'");
    });

    it('drops it when the prefix is absent', () => {
        expect(stripRulePosition('line 3:1 mismatched input')).toBe(
            'mismatched input',
        );
    });

    it('is case-insensitive about the keyword', () => {
        expect(stripRulePosition('rules: Line 2:0 no viable alternative')).toBe(
            'rules: no viable alternative',
        );
    });

    it('leaves a message with no position untouched', () => {
        expect(stripRulePosition('rules: must not be empty')).toBe(
            'rules: must not be empty',
        );
    });

    it('leaves a line reference that is not a position untouched', () => {
        expect(stripRulePosition('the rule spans line 4 and line 5')).toBe(
            'the rule spans line 4 and line 5',
        );
    });
});
