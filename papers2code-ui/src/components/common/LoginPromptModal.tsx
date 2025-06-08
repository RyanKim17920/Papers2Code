import React from 'react';
import './ConfirmationModal.css'; // Reuse existing modal styles or create specific ones
import { redirectToGitHubLogin } from '../../services/auth'; // Import the auth function
import { useModal } from '../../context/ModalContext';

// No direct props needed as all state comes from context
interface LoginPromptModalProps {}

const LoginPromptModal: React.FC<LoginPromptModalProps> = () => {
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
                        className="btn button-primary"
                        onClick={handleConfirmLogin}
                    >
                        Connect with GitHub
                    </button>
                    <button
                        className="btn button-secondary"
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
