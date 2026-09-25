import { toast } from 'sonner';
import { errorMessages } from './api/errors';

/**
 * A failed write, reported as a toast. Separate from `api/errors.ts` to keep
 * `sonner` out of the API layer. Lossy for a multi-error rejection, since it
 * joins the messages with a space; form paths that render `errorMessages` as
 * inline field errors keep the array and must stay that way.
 */
export function toastWriteError(error: unknown): void {
    toast.error(errorMessages(error).join(' '));
}
