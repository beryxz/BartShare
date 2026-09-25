import { LogEvent } from '../models/models';

async function logEvent(
    type: string,
    userId?: string | null,
    data?: Record<string, unknown> | null,
): Promise<void> {
    const occurred_at = new Date().toISOString();
    try {
        await LogEvent.create({
            type,
            UserId: userId ?? undefined,
            data: data ?? null,
            occurred_at,
        });
    } catch {
        // silently swallow: event tracking must never affect the caller
    }
}

export { logEvent };
