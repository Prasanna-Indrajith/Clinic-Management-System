import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';

describe('Patient Login & Demo Account Verification', () => {
  it('renders the Patient demo button on LoginPage and fills credentials when clicked', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Look for demo button with text 'Patient'
    const patientDemoBtn = screen.getByRole('button', { name: /^patient$/i });
    expect(patientDemoBtn).toBeDefined();

    // Click demo button
    fireEvent.click(patientDemoBtn);

    // Email input should now have 'patient@clinic.local'
    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput.value).toBe('patient@clinic.local');
  });
});
