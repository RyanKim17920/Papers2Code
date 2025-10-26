import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

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
        <>
            <style>{`
                @keyframes modalBackdropFadeIn {
                    from {
                        opacity: 0;
                        backdrop-filter: blur(0px);
                        -webkit-backdrop-filter: blur(0px);
                    }
                    to {
                        opacity: 1;
                        backdrop-filter: blur(8px);
                        -webkit-backdrop-filter: blur(8px);
                    }
                }
                @keyframes modalContentSlideIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -48%) scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
            `}</style>
            <div 
                className="fixed inset-0 w-full h-full bg-gradient-to-br from-[rgba(var(--primary-rgb,0,0,0),0.4)] to-[rgba(var(--primary-rgb,0,0,0),0.6)] backdrop-blur-[8px] z-[9999] animate-[modalBackdropFadeIn_0.2s_ease-out]" 
                onClick={handleBackdropClick}
                onMouseDown={handleBackdropMouseDown}
            >
                <div 
                    className="bg-[var(--card-background-color,#ffffff)] p-8 rounded-xl shadow-[var(--box-shadow-md,0_5px_10px_rgba(0,0,0,0.07))] min-w-[320px] max-w-[520px] w-[calc(100%-40px)] max-h-[90vh] overflow-visible border border-[var(--border-color,rgba(0,0,0,0.1))] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[modalContentSlideIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)] max-[640px]:p-6 max-[640px]:rounded-lg max-[640px]:min-w-0 max-[640px]:w-full" 
                    onClick={handleContentClick}
                    onMouseDown={handleContentClick}
                >
                    <button 
                        className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-[var(--danger-color,#dc3545)] text-white border-2 border-white shadow-md flex items-center justify-center text-2xl font-bold cursor-pointer transition-all duration-200 hover:bg-[var(--danger-dark-color,#c82333)] hover:scale-110 hover:shadow-lg active:scale-95 z-10 max-[640px]:-top-2 max-[640px]:-right-2 max-[640px]:w-8 max-[640px]:h-8 max-[640px]:text-xl" 
                        onClick={handleCloseClick}
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-label="Close modal"
                        type="button"
                    >
                        &times;
                    </button>
                    <h2 className="text-2xl font-bold text-[var(--text-heading-color,#1a1a1a)] mb-4 pr-8 leading-tight max-[640px]:text-xl max-[640px]:mb-3">{title}</h2>
                    <div className="mb-8 leading-relaxed text-[var(--text-color,#333333)] flex-grow text-base max-[640px]:mb-6 [&>p]:mt-0 [&>p]:mb-4 [&>p:last-child]:mb-0 [&>strong]:text-[var(--text-heading-color,#1a1a1a)] [&>strong]:font-semibold">
                        {children}
                    </div>
                    <div className="flex justify-end gap-3 mt-auto pt-6 border-t-2 border-[var(--border-color-light,rgba(0,0,0,0.05))] max-[640px]:flex-col max-[640px]:gap-2">
                        <button
                            className={`min-w-[100px] px-6 py-3 rounded-lg font-semibold text-[0.95rem] transition-all duration-200 border-2 border-transparent cursor-pointer relative overflow-hidden hover:-translate-y-px hover:shadow-[var(--box-shadow-sm,0_2px_4px_rgba(0,0,0,0.05))] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-white/0 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 max-[640px]:w-full max-[640px]:min-w-0 ${confirmButtonClass}`}
                            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={isConfirming}
                        >
                            {isConfirming ? 'Processing...' : confirmText}
                        </button>
                        <button
                            className="min-w-[100px] px-6 py-3 rounded-lg font-semibold text-[0.95rem] transition-all duration-200 border-2 border-transparent cursor-pointer relative overflow-hidden hover:-translate-y-px hover:shadow-[var(--box-shadow-sm,0_2px_4px_rgba(0,0,0,0.05))] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-white/0 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 max-[640px]:w-full max-[640px]:min-w-0 btn btn-secondary"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={isConfirming}
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return ReactDOM.createPortal(
        modalContent,
        document.body
    );
};

export default ConfirmationModal;
