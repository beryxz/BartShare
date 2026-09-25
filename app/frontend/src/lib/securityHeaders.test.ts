import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './securityHeaders';

/** Reads one directive out of a policy string, without its name. */
function directive(policy: string, name: string): string | undefined {
    return policy
        .split('; ')
        .find(part => part === name || part.startsWith(`${name} `))
        ?.slice(name.length)
        .trim();
}

describe('contentSecurityPolicy', () => {
    it('keeps the sources Monaco needs', () => {
        const policy = contentSecurityPolicy(false, '');
        // The codicon font is a base64 data: URL and the editor worker is a blob.
        expect(directive(policy, 'font-src')).toBe("'self' data:");
        expect(directive(policy, 'worker-src')).toBe("'self' blob:");
    });

    it('keeps unsafe-inline for styles, which Monaco and Radix require', () => {
        expect(directive(contentSecurityPolicy(false, ''), 'style-src')).toBe(
            "'self' 'unsafe-inline'",
        );
    });

    it('allows the same-origin swagger iframe but no framing of itself', () => {
        const policy = contentSecurityPolicy(false, '');
        expect(directive(policy, 'frame-src')).toBe("'self'");
        expect(directive(policy, 'frame-ancestors')).toBe("'none'");
    });

    it('omits unsafe-eval in production', () => {
        expect(contentSecurityPolicy(false, '')).not.toContain("'unsafe-eval'");
    });

    it('adds unsafe-eval and a websocket source in development', () => {
        const policy = contentSecurityPolicy(true, '');
        expect(directive(policy, 'script-src')).toBe(
            "'self' 'unsafe-inline' 'unsafe-eval'",
        );
        expect(directive(policy, 'connect-src')).toBe("'self' ws:");
    });

    it('stays same-origin only when no API host is configured', () => {
        expect(directive(contentSecurityPolicy(false, ''), 'connect-src')).toBe(
            "'self'",
        );
    });

    it('allows a cross-origin API host when one is configured', () => {
        // Without this the API client's own requests are blocked by the policy
        // in every split-origin setup, `npm run dev` included.
        expect(
            directive(
                contentSecurityPolicy(false, 'http://localhost:8081'),
                'connect-src',
            ),
        ).toBe("'self' http://localhost:8081");
    });

    it('allows framing the API docs on a cross-origin API host', () => {
        // The API docs screen iframes the backend, so frame-src has to track
        // the same host connect-src does.
        expect(
            directive(
                contentSecurityPolicy(false, 'http://localhost:8081'),
                'frame-src',
            ),
        ).toBe("'self' http://localhost:8081");
    });

    it('frames only itself when no API host is configured', () => {
        expect(directive(contentSecurityPolicy(false, ''), 'frame-src')).toBe(
            "'self'",
        );
    });

    it('never emits a nonce, which would void unsafe-inline', () => {
        expect(contentSecurityPolicy(false, '')).not.toContain('nonce-');
    });
});

describe('securityHeaders', () => {
    it('carries the static headers alongside the policy', () => {
        const byKey = new Map(
            securityHeaders(false, '').map(h => [h.key, h.value]),
        );
        expect(byKey.get('Referrer-Policy')).toBe('no-referrer');
        expect(byKey.get('X-Content-Type-Options')).toBe('nosniff');
        expect(byKey.get('X-Frame-Options')).toBe('DENY');
        expect(byKey.get('X-XSS-Protection')).toBe('0');
        expect(byKey.get('Content-Security-Policy')).toBe(
            contentSecurityPolicy(false, ''),
        );
    });

    it('agrees with the policy about framing', () => {
        const byKey = new Map(
            securityHeaders(false, '').map(h => [h.key, h.value]),
        );
        // DENY and frame-ancestors 'none' must not contradict each other.
        expect(byKey.get('X-Frame-Options')).toBe('DENY');
        expect(byKey.get('Content-Security-Policy')).toContain(
            "frame-ancestors 'none'",
        );
    });
});
