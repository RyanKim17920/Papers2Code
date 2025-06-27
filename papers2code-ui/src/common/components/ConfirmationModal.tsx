import React from 'react';
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
    if (!isOpen) {
        return null;
    }    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const modalContent = (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button 
                    className="modal-close-button" 
                    onClick={onClose} 
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
                        onClick={onConfirm}
                        disabled={isConfirming}
                    >
                        {isConfirming ? 'Processing...' : confirmText}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
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
