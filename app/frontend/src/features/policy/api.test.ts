import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteMe, getAccountSummary, toPolicyRules } from './api';

describe('toPolicyRules', () => {
    it('parses a rule the block editor can show', () => {
        const [rule] = toPolicyRules(['(resource:(type:"notes"))']);
        expect(rule.ast).toEqual({ resource: { type: 'notes' } });
        expect(rule.advancedReason).toBeNull();
    });

    it('keeps the server text verbatim, never the reprinted form', () => {
        const source = '( resource : ( type : "notes" ) )';
        const [rule] = toPolicyRules([source]);
        expect(rule.source).toBe(source);
    });

    it('nulls the ast and records why for a syntax error', () => {
        const [rule] = toPolicyRules(['(resource:)']);
        expect(rule.ast).toBeNull();
        expect(rule.advancedReason).toMatch(/line 1:/i);
    });

    it('nulls the ast and records why for a mixed and/or exchange', () => {
        const mixed =
            '(resource:(t:"n"), exchange:(to:me, resource:(t:"a"), from:requester) and (to:me, resource:(t:"b"), from:requester) or (to:me, resource:(t:"c"), from:requester))';
        const [rule] = toPolicyRules([mixed]);
        expect(rule.ast).toBeNull();
        expect(rule.advancedReason).toMatch(/mixes/i);
    });

    it('numbers ids from one, by position', () => {
        const rules = toPolicyRules([
            '(resource:(t:"a"))',
            '(resource:(t:"b"))',
        ]);
        expect(rules.map(r => r.id)).toEqual(['rule-1', 'rule-2']);
    });

    it('survives a rule that parses beside one that does not', () => {
        const rules = toPolicyRules(['(resource:)', '(resource:(t:"b"))']);
        expect(rules[0].ast).toBeNull();
        expect(rules[1].ast).not.toBeNull();
    });

    it('returns an empty list for an empty policy', () => {
        expect(toPolicyRules([])).toEqual([]);
    });
});

/**
 * A fetch stub answering by path, since `getAccountSummary` issues three
 * requests in parallel and each total must land in the right field. Throws on
 * an unmatched path rather than defaulting to zero, so a mistyped path or an
 * added call fails loudly instead of passing with a wrong number.
 */
function mockFetchByPath(totals: Record<string, number>) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            const match = Object.keys(totals).find(path => url.includes(path));
            if (!match) throw new Error(`no stub for ${url}`);
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({
                    data: [],
                    page: {
                        size: 50,
                        totalElements: totals[match],
                        totalPages: 1,
                        number: 1,
                    },
                }),
            };
        }),
    );
}

afterEach(() => vi.unstubAllGlobals());

describe('deleteMe', () => {
    it('sends DELETE to /me and returns the deleted user', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ id: 'u1', attrs: {}, rules: [] }),
            })),
        );
        await expect(deleteMe()).resolves.toEqual({
            id: 'u1',
            attrs: {},
            rules: [],
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/me',
            expect.objectContaining({ method: 'DELETE' }),
        );
    });
});

describe('getAccountSummary', () => {
    it('maps each list total to its own field', async () => {
        mockFetchByPath({
            '/me/resources': 3,
            '/me/connections': 5,
            '/me/groups': 2,
        });
        await expect(getAccountSummary()).resolves.toEqual({
            resources: 3,
            connections: 5,
            groups: 2,
        });
    });

    it('reports zeros for a user who owns nothing', async () => {
        mockFetchByPath({
            '/me/resources': 0,
            '/me/connections': 0,
            '/me/groups': 0,
        });
        await expect(getAccountSummary()).resolves.toEqual({
            resources: 0,
            connections: 0,
            groups: 0,
        });
    });

    it('rejects if any one of the three legs fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                if (url.includes('/me/groups')) {
                    return {
                        ok: false,
                        status: 500,
                        headers: { get: () => 'application/json' },
                        json: async () => ({ errors: ['Server error'] }),
                    };
                }
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({
                        data: [],
                        page: {
                            size: 50,
                            totalElements: 0,
                            totalPages: 1,
                            number: 1,
                        },
                    }),
                };
            }),
        );
        await expect(getAccountSummary()).rejects.toMatchObject({
            status: 500,
        });
    });
});
