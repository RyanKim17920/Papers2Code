import React from 'react';
import './ConfirmationModal.css'; // Reuse existing modal styles or create specific ones
import { redirectToGitHubLogin } from '../services/auth';
import { useModal } from '../context/ModalContext';

const LoginPromptModal: React.FC = () => {
    // MODIFIED: Use correct properties from useModal hook
    const { isLoginPromptOpen, loginPromptMessage, hideLoginPrompt } = useModal();

    if (!isLoginPromptOpen) { // Use isLoginPromptOpen from context
        return null;
    }

    const handleConfirmLogin = () => {
        redirectToGitHubLogin();
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
                    <p>{loginPromptMessage || "Please connect with GitHub to perform this action."}</p>
                </div>
                <div className="modal-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirmLogin}
                    >
                        Connect with GitHub
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
