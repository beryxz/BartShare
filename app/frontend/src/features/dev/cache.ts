import { SCENARIOS_KEY, STATUS_KEY } from '@/lib/api/keys';

/**
 * Which SWR keys a seed or a reset invalidates: nearly all of them, except
 * `SCENARIOS_KEY` (`GET /dev/scenarios`) and `STATUS_KEY`, since no write
 * changes either; `POST /dev/seed` does change the event log, so it stays in.
 */
const WRITE_INDEPENDENT_KEYS: readonly unknown[] = [SCENARIOS_KEY, STATUS_KEY];

export function isDatabaseScopedKey(key: unknown): boolean {
    return !WRITE_INDEPENDENT_KEYS.includes(key);
}
