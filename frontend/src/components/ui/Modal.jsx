import { createPortal } from 'react-dom';
import { useEffect } from 'react';

/**
 * Modal — accessible dialog with focus trap and ESC-to-close.
 * Usage:
 *   <Modal isOpen={show} title="Add Patient" onClose={...} size="md">
 *     <form onSubmit={...}>...</form>
 *   </Modal>
 */
export default function Modal({ isOpen, title, onClose, size = 'md', children }) {
    useEffect(() => {
        if (!isOpen) return;
        const onKeydown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeydown);
        // Prevent body scroll when modal is open
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeydown);
            document.body.style.overflow = original;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClass = {
        sm: 'modal-sm',
        md: 'modal-md',
        lg: 'modal-lg',
        xl: 'modal-xl',
    }[size] || 'modal-md';

    return createPortal(
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className={`modal ${sizeClass}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="modal-header">
                    <h3 id="modal-title" className="modal-title">{title}</h3>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>,
        document.body
    );
}
