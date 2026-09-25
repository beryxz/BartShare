import type { ApiUser } from '@/lib/api/types';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** A wildcard origin, because `apiUrl` emits a relative path only while
 *  `NEXT_PUBLIC_API_HOST` is empty and a set host would miss a fixed origin. */
const API = '*/api/v1';

/** The backend's paginated envelope, which `pageOf` unwraps. */
export function usersHandler(users: ApiUser[]) {
    return http.get(`${API}/users`, () =>
        HttpResponse.json({
            data: users,
            page: {
                size: users.length,
                totalElements: users.length,
                totalPages: 1,
                number: 1,
            },
        }),
    );
}

/**
 * `GET /dev/scenarios` uses the named-wrapper shape, not `{data, page}`:
 * `listScenarios` unwraps `{ scenarios }` directly. `FirstRunLanding`
 * mounts `ScenarioPicker`, which fetches this unconditionally.
 */
function scenariosHandler() {
    return http.get(`${API}/dev/scenarios`, () =>
        HttpResponse.json({ scenarios: [] }),
    );
}

/** `GET /users` is unconditional: `SessionProvider` fetches it on mount, so
 *  every DOM test needs an answer for it whether or not it asserts on one. */
export const server = setupServer(usersHandler([]), scenariosHandler());
