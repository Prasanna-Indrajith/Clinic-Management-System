import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import DoctorsPage from './pages/DoctorsPage';
import UsersPage from './pages/UsersPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'patient' ? '/appointments' : '/dashboard'} replace />;
}

function DashboardOrPatientHome() {
  const { user } = useAuth();
  if (user?.role === 'patient') {
    return <Navigate to="/appointments" replace />;
  }
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes — login only; /register redirects to /login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />

        {/* Protected routes — require auth */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="/dashboard" element={<DashboardOrPatientHome />} />
            <Route path="/appointments" element={<AppointmentsPage />} />

            {/* Patient appointment history */}
            <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
              <Route path="/appointment-history" element={<AppointmentsPage mode="history" />} />
            </Route>

            {/* Clinical directory — Staff only (Admin, Doctor, Receptionist) */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'doctor', 'receptionist']} />}>
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/doctors" element={<DoctorsPage />} />
            </Route>

            {/* User directory & creation — Admin only */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>

            {/* Reports — Admin, Doctor, and Receptionist */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'doctor', 'receptionist']} />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            {/* Admin only routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/users" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
