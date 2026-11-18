import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { usersApi } from '../../api/client';

const ALL_ROLE_OPTIONS = [
  { value: 'patient', label: 'Patient (User)' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'admin', label: 'Clinic Admin' },
];

const RECEPTIONIST_ROLE_OPTIONS = [
  { value: 'patient', label: 'Patient (User)' },
  { value: 'doctor', label: 'Doctor' },
];

/**
 * Reusable modal for creating a new user account.
 * Admin can create any role (including receptionist and admin).
 * Receptionist can only create patient (user) and doctor accounts.
 */
export default function AddUserModal({ isOpen, onClose, onSuccess, currentUserRole }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isAdmin = currentUserRole === 'admin';
  const roleOptions = isAdmin ? ALL_ROLE_OPTIONS : RECEPTIONIST_ROLE_OPTIONS;
  const allowedRoleValues = roleOptions.map((r) => r.value);

  const validationSchema = Yup.object({
    name: Yup.string().trim().min(2, 'At least 2 characters').required('Full name is required'),
    email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
    role: Yup.string().oneOf(allowedRoleValues, 'Invalid role selected').required('Role is required'),
    password: Yup.string().min(8, 'Minimum 8 characters').required('Password is required'),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password')], 'Passwords do not match')
      .required('Please confirm password'),
    specialization: Yup.string().when('role', {
      is: 'doctor',
      then: (s) => s.trim().required('Specialization is required for doctors'),
      otherwise: (s) => s.optional(),
    }),
    contact: Yup.string().when('role', {
      is: 'doctor',
      then: (s) => s.trim().required('Contact number is required for doctors'),
      otherwise: (s) => s.optional(),
    }),
    dob: Yup.string().optional(),
  });

  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      role: 'patient',
      password: '',
      confirmPassword: '',
      specialization: '',
      contact: '',
      dob: '',
    },
    validationSchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        const payload = {
          name: values.name.trim(),
          email: values.email.trim(),
          role: values.role,
          password: values.password,
        };

        if (values.role === 'doctor') {
          payload.specialization = values.specialization.trim();
          payload.contact = values.contact.trim();
        } else if (values.role === 'patient') {
          if (values.contact.trim()) payload.contact = values.contact.trim();
          if (values.dob) payload.dob = values.dob;
        }

        await usersApi.create(payload);
        toast.success(`New ${values.role} account created`);
        resetForm();
        onClose();
        if (onSuccess) onSuccess();
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.details?.[0]?.message ||
          err?.message ||
          'Failed to create user account';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (!isOpen) {
      formik.resetForm();
      setShowPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selectedRole = formik.values.role;

  return (
    <Modal isOpen={isOpen} title="Add New User Account" onClose={onClose} size="md">
      <form onSubmit={formik.handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="add-user-name">Full Name</label>
          <input
            id="add-user-name"
            type="text"
            className={`form-input ${formik.touched.name && formik.errors.name ? 'error' : ''}`}
            placeholder={selectedRole === 'doctor' ? 'e.g. Dr. Kavinda Silva' : 'e.g. Nimali Perera'}
            {...formik.getFieldProps('name')}
          />
          {formik.touched.name && formik.errors.name && (
            <span className="form-error" role="alert">{formik.errors.name}</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="add-user-email">Email Address</label>
            <input
              id="add-user-email"
              type="email"
              className={`form-input ${formik.touched.email && formik.errors.email ? 'error' : ''}`}
              placeholder="user@clinic.local"
              {...formik.getFieldProps('email')}
            />
            {formik.touched.email && formik.errors.email && (
              <span className="form-error" role="alert">{formik.errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-user-role">Account Role</label>
            <select
              id="add-user-role"
              className={`form-input ${formik.touched.role && formik.errors.role ? 'error' : ''}`}
              {...formik.getFieldProps('role')}
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {formik.touched.role && formik.errors.role && (
              <span className="form-error" role="alert">{formik.errors.role}</span>
            )}
          </div>
        </div>

        {selectedRole === 'doctor' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="add-user-specialization">Specialization</label>
              <input
                id="add-user-specialization"
                type="text"
                className={`form-input ${formik.touched.specialization && formik.errors.specialization ? 'error' : ''}`}
                placeholder="e.g. Consultant Cardiologist"
                {...formik.getFieldProps('specialization')}
              />
              {formik.touched.specialization && formik.errors.specialization && (
                <span className="form-error" role="alert">{formik.errors.specialization}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-user-doc-contact">Phone Contact</label>
              <input
                id="add-user-doc-contact"
                type="tel"
                className={`form-input ${formik.touched.contact && formik.errors.contact ? 'error' : ''}`}
                placeholder="e.g. 077-234-5678"
                {...formik.getFieldProps('contact')}
              />
              {formik.touched.contact && formik.errors.contact && (
                <span className="form-error" role="alert">{formik.errors.contact}</span>
              )}
            </div>
          </div>
        )}

        {selectedRole === 'patient' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="add-user-dob">Date of Birth (Optional)</label>
              <input
                id="add-user-dob"
                type="date"
                className="form-input"
                {...formik.getFieldProps('dob')}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-user-pat-contact">Phone Contact (Optional)</label>
              <input
                id="add-user-pat-contact"
                type="tel"
                className="form-input"
                placeholder="e.g. 077-987-6543"
                {...formik.getFieldProps('contact')}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="add-user-password">Password</label>
            <input
              id="add-user-password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${formik.touched.password && formik.errors.password ? 'error' : ''}`}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              {...formik.getFieldProps('password')}
            />
            {formik.touched.password && formik.errors.password && (
              <span className="form-error" role="alert">{formik.errors.password}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-user-confirm-password">Confirm Password</label>
            <input
              id="add-user-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${formik.touched.confirmPassword && formik.errors.confirmPassword ? 'error' : ''}`}
              placeholder="Re-enter password"
              autoComplete="new-password"
              {...formik.getFieldProps('confirmPassword')}
            />
            {formik.touched.confirmPassword && formik.errors.confirmPassword && (
              <span className="form-error" role="alert">{formik.errors.confirmPassword}</span>
            )}
          </div>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          <span>Show password</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
