import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ForbiddenPage from '../../pages/ForbiddenPage';

/**
 * ProtectedRoute — guards routes based on authentication status and allowed roles.
 * Redirects unauthenticated users to /login and renders ForbiddenPage for unauthorized roles.
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && (!user?.role || !allowedRoles.includes(user.role))) {
    return <ForbiddenPage allowedRoles={allowedRoles} />;
  }

  return <Outlet />;
}
