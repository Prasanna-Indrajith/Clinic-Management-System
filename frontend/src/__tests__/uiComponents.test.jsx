import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';

describe('Phase 7 — UI Component Verification (DataTable & Modal)', () => {
  describe('DataTable Component', () => {
    const columns = [
      { key: 'name', label: 'Patient Name', sortable: true },
      { key: 'dob', label: 'Date of Birth', sortable: false },
      {
        key: 'actions',
        label: 'Actions',
        render: (_val, row) => <button data-testid={`btn-${row?.id}`}>View</button>,
      },
    ];

    const sampleData = [
      { id: 1, name: 'John Doe', dob: '1985-05-15' },
      { id: 2, name: 'Jane Smith', dob: '1990-10-20' },
    ];

    it('renders table headers and rows accurately', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 1, totalPages: 1, total: 2 }}
        />
      );

      expect(screen.getByText(/Patient Name/)).toBeDefined();
      expect(screen.getByText('Date of Birth')).toBeDefined();
      expect(screen.getByText('John Doe')).toBeDefined();
      expect(screen.getByText('Jane Smith')).toBeDefined();
      expect(screen.getByTestId('btn-1')).toBeDefined();
    });

    it('renders empty message when data is empty', () => {
      render(
        <DataTable
          columns={columns}
          data={[]}
          pagination={{ page: 1, totalPages: 1, total: 0 }}
        />
      );

      expect(screen.getByText('No records found.')).toBeDefined();
    });

    it('calls onSort when sortable header is clicked', () => {
      const handleSort = vi.fn();
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          onSort={handleSort}
          sortKey="name"
          sortDir="asc"
        />
      );

      const sortableHeader = screen.getByText(/Patient Name/);
      fireEvent.click(sortableHeader);

      expect(handleSort).toHaveBeenCalledWith('name', 'desc');
    });

    it('triggers onPageChange when pagination button is clicked', () => {
      const handlePageChange = vi.fn();
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 1, totalPages: 3, total: 6 }}
          onPageChange={handlePageChange}
        />
      );

      const nextBtn = screen.getByText('Next');
      fireEvent.click(nextBtn);

      expect(handlePageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Modal Component', () => {
    it('does not render content when isOpen is false', () => {
      render(
        <Modal isOpen={false} title="Test Dialog" onClose={() => {}}>
          <div>Hidden Modal Content</div>
        </Modal>
      );

      expect(screen.queryByText('Hidden Modal Content')).toBeNull();
    });

    it('renders title and content when isOpen is true', () => {
      render(
        <Modal isOpen={true} title="Test Dialog" onClose={() => {}}>
          <div>Visible Modal Content</div>
        </Modal>
      );

      expect(screen.getByText('Test Dialog')).toBeDefined();
      expect(screen.getByText('Visible Modal Content')).toBeDefined();
    });

    it('invokes onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} title="Test Dialog" onClose={handleClose}>
          <div>Dialog Content</div>
        </Modal>
      );

      const closeBtn = screen.getByLabelText('Close');
      fireEvent.click(closeBtn);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('invokes onClose when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} title="Test Dialog" onClose={handleClose}>
          <div>Dialog Content</div>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
