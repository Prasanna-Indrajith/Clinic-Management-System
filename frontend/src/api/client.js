import axios from 'axios';
import { authStore } from './authStore';

/**
 * Preconfigured Axios instance.
 * All API calls go through this — never use raw fetch() directly.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Request interceptor — attach JWT from memory store ────────────────────
api.interceptors.request.use((config) => {
  const token = authStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — normalize errors & handle 401 ──────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authStore.clearToken();
      authStore.emitUnauthorized();
    }

    // Normalize error shape — components always get error.message, never raw status codes
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED' ? 'Request timed out — try again.' : 'Something went wrong.');

    return Promise.reject({ ...error, message });
  }
);

export default api;

// Convenience exports
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};
export const patientsApi   = { /* populated in Phase 2/4 */ };
export const appointApi    = { /* populated in Phase 2/4 */ };
export const reportsApi    = { /* populated in Phase 5 */ };
