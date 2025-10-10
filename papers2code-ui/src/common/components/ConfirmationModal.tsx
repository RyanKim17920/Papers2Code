import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import './ConfirmationModal.css'; // Create this CSS file

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonClass?: string; // e.g., 'button-danger', 'button-warning'
    children: React.ReactNode; // Content/message of the modal
    isConfirming?: boolean; // Optional: show loading state on confirm button
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmButtonClass = "btn-primary",
    children,
    isConfirming = false,
}) => {
    // Handle Escape key globally
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape, true); // Use capture phase
        return () => {
            document.removeEventListener('keydown', handleEscape, true);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only close if clicking directly on backdrop, not on modal content
        if (e.target === e.currentTarget) {
            e.stopPropagation();
            e.preventDefault();
            onClose();
        }
    };

    const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent mouseDown events from reaching Dialog for ALL clicks on backdrop
        e.stopPropagation();
    };

    const handleContentClick = (e: React.MouseEvent) => {
        // Prevent clicks on modal content from closing the modal
        e.stopPropagation();
    };

    const handleCloseClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onClose();
    };

    const modalContent = (
        <div 
            className="modal-backdrop" 
            onClick={handleBackdropClick}
            onMouseDown={handleBackdropMouseDown}
        >
            <div 
                className="modal-content" 
                onClick={handleContentClick}
                onMouseDown={handleContentClick}
            >
                <button 
                    className="modal-close-button" 
                    onClick={handleCloseClick}
                    onMouseDown={(e) => e.stopPropagation()}
                    aria-label="Close modal"
                    type="button"
                >
                    &times;
                </button>
                <h2>{title}</h2>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-actions">
                    <button
                        className={`btn ${confirmButtonClass}`}
                        onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        disabled={isConfirming}
                    >
                        {isConfirming ? 'Processing...' : confirmText}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        disabled={isConfirming}
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(
        modalContent,
        document.body
    );
};

export default ConfirmationModal;
