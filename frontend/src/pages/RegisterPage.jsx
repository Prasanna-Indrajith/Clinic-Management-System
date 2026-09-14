import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { authApi } from '../api/client';
import styles from './AuthPage.module.css';

const schema = Yup.object({
  name:            Yup.string().min(2, 'At least 2 characters').required('Full name is required'),
  email:           Yup.string().email('Enter a valid email').required('Email is required'),
  role:            Yup.string().oneOf(['admin', 'doctor', 'receptionist', 'patient']).required('Role is required'),
  password:        Yup.string().min(8, 'Minimum 8 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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

  const field = (name, label, type = 'text', placeholder = '') => (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>{label}</label>
      <input
        id={name}
        type={type}
        className={`form-input ${formik.touched[name] && formik.errors[name] ? 'error' : ''}`}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'new-password' : name}
        {...formik.getFieldProps(name)}
      />
      {formik.touched[name] && formik.errors[name] && (
        <span className="form-error" role="alert">{formik.errors[name]}</span>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.accent} aria-hidden="true" />

      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>CM</div>
          <div>
            <h1 className={styles.brandName}>Clinic<strong>Mate</strong></h1>
            <p className={styles.brandTagline}>Clinic Appointment & Patient Tracker</p>
          </div>
        </div>

        <h2 className={styles.heading}>Create your account</h2>

        <form onSubmit={formik.handleSubmit} noValidate className={styles.form}>
          {field('name',            'Full name',         'text',     'Dr. Jane Smith')}
          {field('email',           'Email address',     'email',    'you@clinic.com')}

          <div className="form-group">
            <label className="form-label" htmlFor="role">Role</label>
            <select
              id="role"
              className={`form-input ${formik.touched.role && formik.errors.role ? 'error' : ''}`}
              {...formik.getFieldProps('role')}
            >
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Clinic Admin</option>
              <option value="patient">Patient</option>
            </select>
            {formik.touched.role && formik.errors.role && (
              <span className="form-error" role="alert">{formik.errors.role}</span>
            )}
          </div>

          {field('password',        'Password',          'password', '••••••••')}
          {field('confirmPassword', 'Confirm password',  'password', '••••••••')}

          <button
            id="btn-register"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : null}
            {loading ? 'Creating account…' : 'Create account'}
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
