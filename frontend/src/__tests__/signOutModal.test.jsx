import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SignOutModal from '../components/auth/SignOutModal';
import * as AuthContext from '../context/AuthContext';
import * as ReactRouter from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SignOutModal Component', () => {
  const mockLogout = vi.fn();
  const mockNavigate = vi.fn();
  const mockOnClose = vi.fn();

  const mockUser = {
    name: 'Dr. Sanduni Perera',
    email: 'dr.smith@clinic.local',
    role: 'doctor',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
    vi.mocked(ReactRouter.useNavigate).mockReturnValue(mockNavigate);
  });

  it('renders nothing when isOpen is false', () => {
    render(<SignOutModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Confirm Sign Out')).toBeNull();
    expect(screen.queryByText('Sign out of your session?')).toBeNull();
  });

  it('renders confirmation dialog with user details when isOpen is true', () => {
    render(<SignOutModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Confirm Sign Out')).toBeDefined();
    expect(screen.getByText('Sign out of your session?')).toBeDefined();
    expect(screen.getByText('Dr. Sanduni Perera')).toBeDefined();
    expect(screen.getByText('Doctor')).toBeDefined();
    expect(screen.getByText('dr.smith@clinic.local')).toBeDefined();
    expect(screen.getByRole('button', { name: /Stay Signed In/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Yes, Sign Out/i })).toBeDefined();
  });

  it('invokes onClose when "Stay Signed In" is clicked without logging out', () => {
    render(<SignOutModal isOpen={true} onClose={mockOnClose} />);

    const cancelBtn = screen.getByRole('button', { name: /Stay Signed In/i });
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('invokes logout, onClose, and navigates to /login when "Yes, Sign Out" is clicked', () => {
    render(<SignOutModal isOpen={true} onClose={mockOnClose} />);

    const confirmBtn = screen.getByRole('button', { name: /Yes, Sign Out/i });
    fireEvent.click(confirmBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
