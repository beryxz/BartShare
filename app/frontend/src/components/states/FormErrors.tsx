/**
 * The backend answers a rejected write with one message per problem, so the
 * whole list renders rather than the first line. Renders nothing when there is
 * nothing wrong, so a caller can mount it unconditionally.
 */
export function FormErrors({ errors }: { errors?: string[] }) {
    if (!errors || errors.length === 0) return null;

    return (
        <ul className="space-y-1">
            {/* Indexed key: the backend can repeat a message, and a duplicate
                React key warns for no reason. */}
            {errors.map((message, i) => (
                <li
                    key={`${i}-${message}`}
                    className="font-mono text-xs text-verdict-deny-fg"
                >
                    {message}
                </li>
            ))}
        </ul>
    );
}
