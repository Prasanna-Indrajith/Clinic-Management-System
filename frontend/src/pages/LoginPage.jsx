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
      <div className={styles.accent} aria-hidden="true" />
      <div className={styles.accentSecondary} aria-hidden="true" />

      <div className={styles.authContainer}>
        {/* Left Clinical Showcase Panel (Desktop) */}
        <section className={styles.showcasePanel}>
          <div className={styles.showcaseTop}>
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

            <div className={styles.heroContent}>
              <h2 className={styles.heroTitle}>High-reliability clinical operations & scheduling</h2>
              <p className={styles.heroDesc}>
                Engineered for outpatient front desks, consultation rooms, and clinical managers.
                Frictionless visit transitions with instant PDF audit reporting.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <div className={styles.featureIconWrap}>
                    <svg className={styles.featureIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className={styles.featureText}>
                    <span className={styles.featureTitle}>Conflict-Free Scheduling</span>
                    <span className={styles.featureSubtitle}>Real-time practitioner slot management</span>
                  </div>
                </li>

                <li className={styles.featureItem}>
                  <div className={styles.featureIconWrap}>
                    <svg className={styles.featureIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div className={styles.featureText}>
                    <span className={styles.featureTitle}>Role-Gated Clinical Records</span>
                    <span className={styles.featureSubtitle}>Separation of Receptionist, Doctor, & Admin views</span>
                  </div>
                </li>

                <li className={styles.featureItem}>
                  <div className={styles.featureIconWrap}>
                    <svg className={styles.featureIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div className={styles.featureText}>
                    <span className={styles.featureTitle}>One-Click PDF Reports</span>
                    <span className={styles.featureSubtitle}>Daily appointments, patient history & revenue</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className={styles.showcaseBottom}>
            <div className={styles.statusIndicator}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span>All Clinical Services Operational</span>
            </div>
            <span className={styles.versionBadge}>v1.0.0-prod</span>
          </div>
        </section>

        {/* Right Form Panel */}
        <section className={styles.formPanel}>
          <div className={styles.card}>
            {/* Mobile-only brand header */}
            <div className={styles.mobileBrand}>
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

            <h2 className={styles.heading}>Sign in to your account</h2>
            <p className={styles.subheading}>Enter your credentials to access your clinic portal</p>

            {/* Quick Demo Role Preset Pills */}
            <div className={styles.demoSection}>
              <div className={styles.demoHeader}>
                <span className={styles.demoLabel}>Demo Fast-Fill</span>
                <span className={styles.demoHint}>Click to test role</span>
              </div>
              <div className={styles.demoPills}>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    className={`${styles.demoPill} ${activeDemo === acc.role ? styles.demoPillActive : ''}`}
                    onClick={() => handleSelectDemo(acc)}
                  >
                    <span>{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="password">Password</label>
                </div>
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
                <span>{loading ? 'Authenticating…' : 'Sign In to Portal'}</span>
              </button>
            </form>

            <p className={styles.switch}>
              Need staff registration?{' '}
              <Link to="/register">Create an account</Link>
            </p>

            <div className={styles.securityNote}>
              <svg className={styles.securityIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>256-bit SSL encrypted clinical session</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
