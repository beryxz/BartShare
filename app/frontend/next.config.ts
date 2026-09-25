import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/securityHeaders';

const nextConfig: NextConfig = {
    // Makes the runtime stage copyable without node_modules; see Dockerfile.
    output: 'standalone',
    poweredByHeader: false,
    devIndicators: {
        position: 'bottom-right',
    },
    async headers() {
        return [
            {
                // Everything, including static assets and error responses
                source: '/(.*)',
                headers: securityHeaders(
                    process.env.NODE_ENV === 'development',
                    process.env.NEXT_PUBLIC_API_HOST ?? '',
                ),
            },
        ];
    },
};

export default nextConfig;
