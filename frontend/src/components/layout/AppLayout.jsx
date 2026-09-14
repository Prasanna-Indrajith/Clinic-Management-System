import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Dashboard',     icon: '⬛' },
  { to: '/patients',     label: 'Patients',      icon: '👤' },
  { to: '/doctors',      label: 'Doctors',       icon: '🩺' },
  { to: '/appointments', label: 'Appointments',  icon: '📅' },
  { to: '/reports',      label: 'Reports',       icon: '📊' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>CM</span>
          <span className={styles.logoText}>Clinic<strong>Mate</strong></span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon} aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className={styles.userName}>{user?.name ?? 'User'}</p>
              <p className={styles.userRole}>{user?.role ?? 'Staff'}</p>
            </div>
          </div>
          <button
            id="btn-logout"
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Sign out"
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
