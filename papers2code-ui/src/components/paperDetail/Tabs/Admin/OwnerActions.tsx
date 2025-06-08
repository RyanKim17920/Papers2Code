import React, { useState, useEffect } from 'react';
// Import the backend-compatible status type if available, or use string literals directly for comparison.
// For now, we assume paper.implementabilityStatus is already correctly typed with backend values.
import { Paper } from '../../../../types/paper';
import { AdminSettableImplementabilityStatus } from '../../../../hooks/usePaperDetail';
import type { UserProfile } from '../../../../types/user';
// import './OwnerActions.css'; // Assuming this will be fixed or is not critical for this change

interface OwnerActionsProps {
    paper: Paper;
    currentUser: UserProfile | null;
    onPaperUpdate: (updatedPaper: Paper) => void;
    openConfirmStatusModal: (status: AdminSettableImplementabilityStatus) => void; 
    onRequestRemoveConfirmation: () => void; // New prop for triggering remove confirmation
    isUpdatingStatus: boolean;
    isRemoving: boolean;
}

export const OwnerActions: React.FC<OwnerActionsProps> = ({
    paper,
    openConfirmStatusModal,
    onRequestRemoveConfirmation, // Added
    isUpdatingStatus,
    isRemoving
}) => {
    const [actionClicked, setActionClicked] = useState<AdminSettableImplementabilityStatus | null>(null);

    useEffect(() => {
        if (!isUpdatingStatus) {
            setActionClicked(null);
        }
    }, [isUpdatingStatus]);


    const handleImplementabilityAction = (status: AdminSettableImplementabilityStatus) => {
        if (!isUpdatingStatus) {
            setActionClicked(status);
            openConfirmStatusModal(status);
        }
    };

    const getEffectiveImplementabilityText = () => {
        switch (paper.implementabilityStatus) {
            case 'Admin Not Implementable':
                return 'Implementable (Admin Set)';
            case 'Admin Implementable':
                return 'Not-Implementable (Admin Set)';
            case 'Voting':
                return 'Community Voting Active';
            default:
                console.warn("Unexpected paper.implementabilityStatus in OwnerActions: ", paper.implementabilityStatus);
                // Provide a fallback display for any other status that might appear
                return paper.implementabilityStatus ? String(paper.implementabilityStatus).replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
        }
    };

    return (
        <div className="paper-actions">
            <div className="privileged-actions">
                <h3>Owner Actions (Danger Zone)</h3>

                <div className="owner-action-group">
                    <h4>Implementability Status Management</h4>
                    <button
                        className="btn button-warning"
                        onClick={() => handleImplementabilityAction('Admin Not Implementable')}
                        // Compare paper.implementabilityStatus (backend value) with the corresponding backend string literal
                        disabled={isUpdatingStatus || paper.implementabilityStatus === 'Community Not Implementable'}
                    >
                        {isUpdatingStatus && actionClicked === 'Admin Not Implementable' ? 'Processing...' : 'Force Not-Implementable'}
                    </button>
                    <button
                        className="btn button-secondary"
                        onClick={() => handleImplementabilityAction('Admin Implementable')}
                        // Compare paper.implementabilityStatus (backend value) with the corresponding backend string literal
                        disabled={isUpdatingStatus || paper.implementabilityStatus === 'Community Implementable'}
                    >
                        {isUpdatingStatus && actionClicked === 'Admin Implementable' ? 'Processing...' : 'Force Implementable'}
                    </button>
                    <button
                        className="btn button-secondary"
                        onClick={() => handleImplementabilityAction('Voting')}
                        // Compare paper.implementabilityStatus (backend value) with the corresponding backend string literal
                        disabled={isUpdatingStatus || paper.implementabilityStatus === 'Voting'}
                    >
                        {isUpdatingStatus && actionClicked === 'Voting' ? 'Processing...' : 'Revert to Voting'}
                    </button>
                    <p className="warning-text">
                        Current status: {getEffectiveImplementabilityText()}
                        <br />
                        Force or lock implementability status, or revert to community voting.
                    </p>
                </div>
                {/*
                <div className="owner-action-group">
                    <h4>Paper Implementation Status</h4>
                    <button
                        className={`btn button-secondary status-not-started`}
                        onClick={() => handleUpdatePaperStatus('Not Started')}
                        disabled={isUpdatingImplStatus || paper.status === 'Not Started'}
                    >
                        {isUpdatingImplStatus && markingStatus === 'Not Started' ? 'Processing...' : 'Mark as Not Started'}
                    </button>
                    <button
                        className={`btn button-secondary status-started`}
                        onClick={() => handleUpdatePaperStatus('Work in Progress')}
                        disabled={isUpdatingImplStatus || paper.status === 'Work in Progress'}
                    >
                        {isUpdatingImplStatus && markingStatus === 'Work in Progress' ? 'Processing...' : 'Mark as In Progress'}
                    </button>
                    <button
                        className={`btn button-success status-completed`}
                        onClick={() => handleUpdatePaperStatus('Completed')}
                        disabled={isUpdatingImplStatus || paper.status === 'Completed'}
                    >
                        {isUpdatingImplStatus && markingStatus === 'Completed' ? 'Processing...' : 'Mark as Completed'}
                    </button>
                </div>
                */}
                <div className="owner-action-group">
                    <h4>Remove Paper</h4>
                    <button 
                        className="btn button-danger" 
                        onClick={onRequestRemoveConfirmation} // Use new prop
                        disabled={isRemoving}
                    >
                        {isRemoving ? 'Processing...' : 'Remove This Paper'}
                    </button>
                    <p className="warning-text">This action is permanent and cannot be undone.</p>
                </div>
            </div>
        </div>
    );
};
