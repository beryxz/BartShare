'use client';

import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

/**
 * The backend's OpenAPI reference, framed from `/api/v1/swagger/ui` so the
 * shell stays put. Client-side because `apiUrl` needs the API host inlined at
 * build time; a server render would read it unset in the container image.
 */
export function ApiDocsPage() {
    const docsUrl = apiUrl('/api/v1/swagger/ui');

    return (
        <div>
            <PageHeader
                title="API docs"
                description="The backend's OpenAPI reference"
                actions={
                    <Button variant="outline" size="sm" asChild>
                        <a href={docsUrl} target="_blank" rel="noreferrer">
                            <ExternalLink />
                            Open in new tab
                        </a>
                    </Button>
                }
            />

            {/* svh, not vh: mobile browser chrome would push the bottom off screen. */}
            <iframe
                src={docsUrl}
                title="Backend API documentation"
                className="h-[calc(100svh-12rem)] min-h-[24rem] w-full rounded-md border bg-white"
            />
        </div>
    );
}
