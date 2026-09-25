import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Dashboard',     icon: '⬛' },
  { to: '/patients',     label: 'Patients',      icon: '👤', roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/doctors',      label: 'Doctors',       icon: '🩺', roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/appointments', label: 'Appointments',  icon: '📅' },
  { to: '/reports',      label: 'Reports',       icon: '📊', roles: ['admin', 'doctor'] },
  { to: '/admin',        label: 'Admin',         icon: '⚙️', roles: ['admin'] },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  ).map((item) => {
    if (user?.role === 'patient') {
      if (item.to === '/dashboard') return { ...item, label: 'My Portal' };
      if (item.to === '/appointments') return { ...item, label: 'My Appointments' };
    }
    return item;
  });

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>CM</span>
          <span className={styles.logoText}>Clinic<strong>Mate</strong></span>
        </div>

        <nav className={styles.nav}>
          {visibleNavItems.map(({ to, label, icon }) => (
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
              {getInitials(user?.name)}
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
