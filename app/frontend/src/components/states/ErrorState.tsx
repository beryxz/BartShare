import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

/**
 * `500` and `503` come from any evaluator-backed endpoint (`/access`,
 * `/me/shared`, a rules-carrying `PATCH /me`): the evaluator can be unreachable
 * (503), and a stored policy can be invalid despite write-time validation
 * (500). `400` is reachable on a read too, a malformed UUID in a path.
 */
const TITLES: Record<number, string> = {
    400: 'That request was rejected',
    401: 'Acting user is no longer valid',
    403: 'Not yours',
    500: 'A stored policy is invalid',
    503: 'Evaluator unavailable',
};

/** Renders the backend's error taxonomy in the operator's terms. */
export function ErrorState({
    error,
    onRetry,
}: {
    error: unknown;
    onRetry?: () => void;
}) {
    const isApi = error instanceof ApiError;
    const title =
        (isApi ? TITLES[error.status] : undefined) ?? 'Something went wrong';
    const detail = isApi
        ? error.errors.join(' ')
        : error instanceof Error
          ? error.message
          : String(error);

    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-verdict-deny-border bg-verdict-deny-bg/40 p-8 text-center">
            <p className="font-medium text-verdict-deny-fg">{title}</p>
            <p className="max-w-md text-sm text-muted-foreground">{detail}</p>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    Try again
                </Button>
            )}
        </div>
    );
}
