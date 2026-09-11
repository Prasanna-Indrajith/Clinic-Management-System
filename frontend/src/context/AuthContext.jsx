import { createContext, useContext, useState, useCallback } from 'react';

/**
 * AuthContext — Phase 0 stub.
 * Phase 1 will replace setToken/clearToken with real JWT logic,
 * and user/token will be loaded from httpOnly cookie or memory store.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);    // { id, name, email, role }
  const [token, setToken] = useState(null);  // JWT string — stored in memory, not localStorage

  const login = useCallback((userData, jwt) => {
    setUser(userData);
    setToken(jwt);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    // TODO (Phase 1): also call POST /api/auth/logout to revoke refresh token
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
