import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { authApi } from '../api/client';
import styles from './AuthPage.module.css';

const schema = Yup.object({
  name: Yup.string().min(2, 'At least 2 characters').required('Full name is required'),
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  role: Yup.string().oneOf(['admin', 'doctor', 'receptionist', 'patient']).required('Role is required'),
  password: Yup.string().min(8, 'Minimum 8 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const formik = useFormik({
    initialValues: { name: '', email: '', role: 'receptionist', password: '', confirmPassword: '' },
    validationSchema: schema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        await authApi.register({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
        });
        toast.success('Account created successfully — please sign in');
        navigate('/login');
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.details?.[0]?.message ||
          err?.message ||
          'Registration failed. Please try again.';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
  });

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
          <h2 className={styles.heading}>Create account</h2>
          <p className={styles.subheading}>Register your credentials to join your clinic team</p>
        </div>

        {/* Form */}
        <form onSubmit={formik.handleSubmit} noValidate className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full name</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="name"
                type="text"
                className={`form-input ${styles.inputWithIcon} ${
                  formik.touched.name && formik.errors.name ? 'error' : ''
                }`}
                placeholder="Dr. Jane Smith"
                autoComplete="name"
                {...formik.getFieldProps('name')}
              />
            </div>
            {formik.touched.name && formik.errors.name && (
              <span className="form-error" role="alert">{formik.errors.name}</span>
            )}
          </div>

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
                placeholder="you@clinic.local"
                autoComplete="email"
                {...formik.getFieldProps('email')}
              />
            </div>
            {formik.touched.email && formik.errors.email && (
              <span className="form-error" role="alert">{formik.errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="role">Role</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <select
                id="role"
                className={`form-input ${styles.inputWithIcon} ${
                  formik.touched.role && formik.errors.role ? 'error' : ''
                }`}
                {...formik.getFieldProps('role')}
              >
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Clinic Admin</option>
                <option value="patient">Patient</option>
              </select>
            </div>
            {formik.touched.role && formik.errors.role && (
              <span className="form-error" role="alert">{formik.errors.role}</span>
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
                autoComplete="new-password"
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

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className={`form-input ${styles.inputWithIcon} ${
                  formik.touched.confirmPassword && formik.errors.confirmPassword ? 'error' : ''
                }`}
                placeholder="••••••••••••"
                autoComplete="new-password"
                {...formik.getFieldProps('confirmPassword')}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? (
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
            {formik.touched.confirmPassword && formik.errors.confirmPassword && (
              <span className="form-error" role="alert">{formik.errors.confirmPassword}</span>
            )}
          </div>

          <button
            id="btn-register"
            type="submit"
            className={`btn btn-primary btn-full btn-lg ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : null}
            <span>{loading ? 'Creating account…' : 'Create account'}</span>
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
