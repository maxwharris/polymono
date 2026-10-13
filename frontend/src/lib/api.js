// One way to talk to the backend: adds the token, checks the status, and throws ApiError with the
// server's message. A 401 calls the handler registered with onUnauthorized (the store logs out), unless the
// caller passes logoutOn401: false (POST /auth/password answers 401 for a wrong current password).
//
// The token is this tab's session token, kept in memory (setApiToken), not whatever localStorage holds: another
// tab may have logged in as someone else, and storage may be blocked altogether.
export const API_URL = import.meta.env.VITE_BACKEND_URL || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler = null;
let sessionToken; // undefined until the store starts or ends a session; then this tab's token or null

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

/** The store calls this whenever this tab's session starts, changes token, or ends (null). */
export function setApiToken(token) {
  sessionToken = token || null;
}

// Before the store has a session (the first moments after a reload, e.g. on /admin), fall back to storage.
export function getToken() {
  if (sessionToken !== undefined) return sessionToken;
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export async function api(path, { method = 'GET', body, token = getToken(), logoutOn401 = true } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && token && logoutOn401 && unauthorizedHandler) unauthorizedHandler(token);
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status);
  }
  return data;
}
