import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import styles from './AuthPage.module.css';

const schema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

const DEMO_ACCOUNTS = [
  { role: 'Patient', label: 'Patient', email: 'patient@clinic.local', pass: 'PatientPass123!' },
  { role: 'Receptionist', label: 'Reception', email: 'receptionist@clinic.local', pass: 'ReceptionPass123!' },
  { role: 'Doctor', label: 'Doctor', email: 'dr.smith@clinic.local', pass: 'DoctorPass123!' },
  { role: 'Admin', label: 'Admin', email: 'admin@clinic.local', pass: 'AdminPass123!' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeDemo, setActiveDemo] = useState(null);

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: schema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const { data } = await authApi.login({
          email: values.email,
          password: values.password,
        });
        const userObj = {
          id: data.user?.user_id || data.user?.id,
          name: data.user?.name,
          email: data.user?.email,
          role: data.user?.role,
        };
        login(userObj, data.token);
        toast.success(`Welcome back, ${userObj.name || 'User'}!`);
        const destination = location.state?.from?.pathname || '/dashboard';
        navigate(destination, { replace: true });
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          'Login failed. Check your credentials.';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
  });

  const handleSelectDemo = (account) => {
    setActiveDemo(account.role);
    formik.setFieldValue('email', account.email);
    formik.setFieldValue('password', account.pass);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandMark} aria-hidden="true">
            <svg className={styles.brandIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M3 12h18" />
              <path d="M7 12h2l2-3 2 6 2-3h2" />
            </svg>
          </div>
          <div>
            <h1 className={styles.brandName}>Clinic<strong>Mate</strong></h1>
            <p className={styles.brandTagline}>Clinic Appointment & Patient Tracker</p>
          </div>
        </div>

        {/* Heading */}
        <div className={styles.headerGroup}>
          <h2 className={styles.heading}>Sign in</h2>
          <p className={styles.subheading}>Enter your credentials to access your clinic portal</p>
        </div>

        {/* Fast-Fill Demo Roles */}
        <div className={styles.demoBar}>
          <span className={styles.demoLabel}>Demo</span>
          <div className={styles.demoPills}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.role}
                type="button"
                className={`${styles.demoPill} ${activeDemo === acc.role ? styles.demoPillActive : ''}`}
                onClick={() => handleSelectDemo(acc)}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={formik.handleSubmit} noValidate className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                id="email"
                type="email"
                className={`form-input ${styles.inputWithIcon} ${
                  formik.touched.email && formik.errors.email ? 'error' : ''
                }`}
                placeholder="receptionist@clinic.local"
                autoComplete="email"
                {...formik.getFieldProps('email')}
              />
            </div>
            {formik.touched.email && formik.errors.email && (
              <span className="form-error" role="alert">{formik.errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${styles.inputWithIcon} ${
                  formik.touched.password && formik.errors.password ? 'error' : ''
                }`}
                placeholder="••••••••••••"
                autoComplete="current-password"
                {...formik.getFieldProps('password')}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {formik.touched.password && formik.errors.password && (
              <span className="form-error" role="alert">{formik.errors.password}</span>
            )}
          </div>

          <button
            id="btn-login"
            type="submit"
            className={`btn btn-primary btn-full btn-lg ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : null}
            <span>{loading ? 'Authenticating…' : 'Sign in'}</span>
          </button>
        </form>

        <p className={styles.switch}>
          Don't have an account?{' '}
          <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
