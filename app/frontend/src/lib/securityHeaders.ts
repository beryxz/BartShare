export function contentSecurityPolicy(isDev: boolean, apiHost: string): string {
    const connect = ["'self'", apiHost, isDev ? 'ws:' : ''].filter(Boolean);
    const frame = ["'self'", apiHost].filter(Boolean);
    return [
        "default-src 'self'",
        // 'unsafe-eval' is React's dev-only server error reconstruction.
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        // data: is Monaco's codicon font.
        "font-src 'self' data:",
        `connect-src ${connect.join(' ')}`,
        // blob: is the Monaco editor worker.
        "worker-src 'self' blob:",
        // The API docs screen frames the backend's swagger UI, on apiHost when split-origin.
        `frame-src ${frame.join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; ');
}

export function securityHeaders(
    isDev: boolean,
    apiHost: string,
): { key: string; value: string }[] {
    return [
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '0' }, // 0 disables the legacy auditor
        {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy(isDev, apiHost),
        },
    ];
}
