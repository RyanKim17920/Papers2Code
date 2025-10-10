import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
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
                className={`modal-content ${className}`}
                style={{ maxWidth }}
                onClick={handleContentClick}
                onMouseDown={handleContentClick}
            >
                {showCloseButton && (
                    <button 
                        className="modal-close-button" 
                        onClick={handleCloseClick}
                        onMouseDown={(e) => e.stopPropagation()}
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

    return ReactDOM.createPortal(modalContent, document.body);
};

export default Modal;
