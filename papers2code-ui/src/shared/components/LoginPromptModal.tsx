import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '@/shared/contexts/ModalContext';

const LoginPromptModal: React.FC = () => {
    const navigate = useNavigate();
    // MODIFIED: Use correct properties from useModal hook
    const { isLoginPromptOpen, loginPromptMessage, hideLoginPrompt } = useModal();

    if (!isLoginPromptOpen) { // Use isLoginPromptOpen from context
        return null;
    }

    const handleConfirmLogin = () => {
        // Navigate to login page instead of direct GitHub OAuth
        navigate('/login');
        hideLoginPrompt(); // Use hideLoginPrompt from context
    };

    const handleCancel = () => {
        hideLoginPrompt(); // Use hideLoginPrompt from context
    };

    return (
        <div className="modal-backdrop" onClick={handleCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={handleCancel} aria-label="Close modal">&times;</button>
                <h2>Login Required</h2>
                <div className="modal-body">
                    {/* MODIFIED: Use loginPromptMessage from context */}
                    <p>{loginPromptMessage || "Please sign in to perform this action."}</p>
                </div>
                <div className="modal-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirmLogin}
                    >
                        Sign In
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPromptModal;
