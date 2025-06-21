import React from 'react';
import './ConfirmationModal.css'; // Reuse the same CSS since they have similar structure

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    maxWidth?: string;
    children: React.ReactNode;
    showCloseButton?: boolean;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    maxWidth = '520px',
    children,
    showCloseButton = true,
    className = '',
}) => {
    if (!isOpen) {
        return null;
    }

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div 
            className="modal-backdrop" 
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            <div 
                className={`modal-content ${className}`}
                style={{ maxWidth }}
                onClick={(e) => e.stopPropagation()}
            >
                {showCloseButton && (
                    <button 
                        className="modal-close-button" 
                        onClick={onClose} 
                        aria-label="Close modal"
                        type="button"
                    >
                        &times;
                    </button>
                )}
                
                <h2>{title}</h2>
                
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
