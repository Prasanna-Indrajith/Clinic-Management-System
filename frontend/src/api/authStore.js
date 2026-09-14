/**
 * In-memory token storage.
 * Keeps the JWT out of localStorage to mitigate persistent XSS vulnerabilities.
 * Backed by sessionStorage for tab reload persistence.
 */

let _token = null;
const _listeners = new Set();

export const authStore = {
  getToken: () => {
    if (_token) return _token;
    try {
      const stored = sessionStorage.getItem('cm_token');
      if (stored) {
        _token = stored;
        return _token;
      }
    } catch {
      // sessionStorage unavailable (e.g. non-browser environment / private mode)
    }
    return null;
  },

  setToken: (token) => {
    _token = token;
    try {
      if (token) {
        sessionStorage.setItem('cm_token', token);
      } else {
        sessionStorage.removeItem('cm_token');
      }
    } catch {
      // ignore storage errors
    }
  },

  clearToken: () => {
    _token = null;
    try {
      sessionStorage.removeItem('cm_token');
      sessionStorage.removeItem('cm_user');
    } catch {
      // ignore storage errors
    }
  },

  onUnauthorized: (callback) => {
    _listeners.add(callback);
    return () => _listeners.delete(callback);
  },

  emitUnauthorized: () => {
    _listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore callback error
      }
    });
  },
};
