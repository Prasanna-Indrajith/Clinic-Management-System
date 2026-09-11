import axios from 'axios';

/**
 * Preconfigured Axios instance.
 * All API calls go through this — never use raw fetch() directly.
 *
 * Phase 1 additions:
 *  - Request interceptor to attach Authorization: Bearer <token>
 *  - Response interceptor to handle 401 (token refresh) and 403
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // For httpOnly cookies if used in Phase 1
});

// ── Request interceptor — attach JWT from memory store ────────────────────
// TODO (Phase 1): import the auth store and inject token here
// api.interceptors.request.use((config) => {
//   const token = authStore.getToken();
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// ── Response interceptor — normalize errors ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalize error shape — components always get error.message, never raw status codes
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED' ? 'Request timed out — try again.' : 'Something went wrong.');

    // TODO (Phase 1): handle 401 token refresh, 403 role errors
    return Promise.reject({ ...error, message });
  }
);

export default api;

// Convenience exports
export const authApi       = { /* populated in Phase 1 */ };
export const patientsApi   = { /* populated in Phase 2/4 */ };
export const appointApi    = { /* populated in Phase 2/4 */ };
export const reportsApi    = { /* populated in Phase 5 */ };
