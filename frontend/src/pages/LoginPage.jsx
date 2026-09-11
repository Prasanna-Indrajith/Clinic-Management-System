import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import styles from './AuthPage.module.css';

const schema = Yup.object({
  email: Yup.string().email('Enter a valid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: schema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        // TODO (Phase 1): replace with real API call
        // const { data } = await api.post('/auth/login', values);
        // login(data.user, data.token);

        // Phase 0 placeholder — simulates a successful login
        await new Promise((r) => setTimeout(r, 800));
        login({ id: 1, name: 'Demo Admin', email: values.email, role: 'admin' }, 'demo-token');
        toast.success('Welcome back!');
        navigate('/dashboard');
      } catch (err) {
        // Never display raw error messages from the server to avoid leaking info
        const msg = err?.response?.data?.error ?? 'Login failed. Check your credentials.';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className={styles.page}>
      <div className={styles.accent} aria-hidden="true" />

      <div className={styles.card}>
        {/* Brand mark */}
        <div className={styles.brand}>
          <div className={styles.brandMark}>CM</div>
          <div>
            <h1 className={styles.brandName}>Clinic<strong>Mate</strong></h1>
            <p className={styles.brandTagline}>Clinic Appointment & Patient Tracker</p>
          </div>
        </div>

        <h2 className={styles.heading}>Sign in to your account</h2>

        <form onSubmit={formik.handleSubmit} noValidate className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className={`form-input ${formik.touched.email && formik.errors.email ? 'error' : ''}`}
              placeholder="you@clinic.com"
              autoComplete="email"
              {...formik.getFieldProps('email')}
            />
            {formik.touched.email && formik.errors.email && (
              <span className="form-error" role="alert">{formik.errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={`form-input ${formik.touched.password && formik.errors.password ? 'error' : ''}`}
              placeholder="••••••••"
              autoComplete="current-password"
              {...formik.getFieldProps('password')}
            />
            {formik.touched.password && formik.errors.password && (
              <span className="form-error" role="alert">{formik.errors.password}</span>
            )}
          </div>

          <button
            id="btn-login"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.switch}>
          No account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
