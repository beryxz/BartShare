import { Op } from 'sequelize';
import { User } from '../models/models';

/** Body text for the 400 a duplicate username earns. */
export const MSG_USERNAME_TAKEN = "attrs: 'username' is already taken";

/**
 * Returns `attrs` with `username` trimmed, if it carries one.
 *
 * Untrimmed, `"bob"` and `"bob "` would both pass validation without
 * colliding, defeating `isUsernameTaken`'s uniqueness, and a padded name
 * could exceed the 128-character limit.
 */
export function normalizeAttrsUsername(
    attrs: Record<string, unknown>,
): Record<string, unknown> {
    const { username } = attrs;
    if (typeof username !== 'string') return attrs;
    return { ...attrs, username: username.trim() };
}

/**
 * Whether another user already publishes this username.
 *
 * Checked here, not via a DB constraint (the column is JSON): two
 * concurrent creates can therefore both pass.
 *
 * @param exceptUserId a user allowed to hold the name, itself, on a PATCH
 */
export async function isUsernameTaken(
    username: string,
    exceptUserId?: string,
): Promise<boolean> {
    const where: Record<string, unknown> = { 'attrs.username': username };
    if (exceptUserId !== undefined) where.id = { [Op.ne]: exceptUserId };

    const existing = await User.findOne({ where, attributes: ['id'] });
    return existing !== null;
}
