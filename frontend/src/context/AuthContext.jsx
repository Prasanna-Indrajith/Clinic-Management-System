import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authStore } from '../api/authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem('cm_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => authStore.getToken());
  const isAuthReady = true;

  const logout = useCallback(() => {
    authStore.clearToken();
    setUser(null);
    setToken(null);
  }, []);

  const login = useCallback((userData, jwt) => {
    authStore.setToken(jwt);
    try {
      sessionStorage.setItem('cm_user', JSON.stringify(userData));
    } catch {
      // ignore storage errors
    }
    setUser(userData);
    setToken(jwt);
  }, []);

  useEffect(() => {
    // Subscribe to automatic 401 logout from Axios interceptors
    const unsubscribe = authStore.onUnauthorized(() => {
      logout();
    });

    return () => unsubscribe();
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!user && !!token,
        isAuthReady,
      }}
    >
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
