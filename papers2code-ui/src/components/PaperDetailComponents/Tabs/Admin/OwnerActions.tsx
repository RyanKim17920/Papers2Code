import React, { useState, useEffect } from 'react';
// Import the backend-compatible status type if available, or use string literals directly for comparison.
// For now, we assume paper.implementabilityStatus is already correctly typed with backend values.
import { Paper } from '../../../../types/paper'; 
import { AdminSettableImplementabilityStatus } from '../../../../hooks/usePaperDetail';
import { UserProfile } from '../../../../services/auth';
import { updatePaperStatusInApi } from '../../../../services/api';
import { getStatusClass } from '../../../../utils/statusUtils';
// import './OwnerActions.css'; // Assuming this will be fixed or is not critical for this change

interface OwnerActionsProps {
    paper: Paper;
    currentUser: UserProfile | null;
    onPaperUpdate: (updatedPaper: Paper) => void;
    setUpdateError: (error: string | null) => void;
    openConfirmStatusModal: (status: AdminSettableImplementabilityStatus) => void; 
    openConfirmRemoveModal: () => void;
    isUpdatingStatus: boolean;
    isRemoving: boolean;
}

export const OwnerActions: React.FC<OwnerActionsProps> = ({
    paper,
    currentUser,
    onPaperUpdate,
    setUpdateError,
    openConfirmStatusModal,
    openConfirmRemoveModal,
    isUpdatingStatus,
    isRemoving
}) => {
    const [isUpdatingImplStatus, setIsUpdatingImplStatus] = useState<boolean>(false);
    const [actionClicked, setActionClicked] = useState<AdminSettableImplementabilityStatus | null>(null);

    useEffect(() => {
        if (!isUpdatingStatus) {
            setActionClicked(null);
        }
    }, [isUpdatingStatus]);

    const handleUpdatePaperStatus = async (newStatus: string) => {
        if (!currentUser || !paper.id) return;
        setIsUpdatingImplStatus(true);
        setUpdateError(null);
        try {
            const updatedPaper = await updatePaperStatusInApi(paper.id, newStatus, currentUser.id);
            if (updatedPaper) {
                onPaperUpdate(updatedPaper);
            }
        } catch (err) {
            if (err instanceof Error) {
                setUpdateError(err.message || 'Failed to update paper status');
            } else {
                setUpdateError('An unknown error occurred while updating paper status');
            }
        } finally {
            setIsUpdatingImplStatus(false);
        }
    };

    const handleImplementabilityAction = (status: AdminSettableImplementabilityStatus) => {
        if (!isUpdatingStatus) {
            setActionClicked(status);
            openConfirmStatusModal(status);
        }
    };

    const getEffectiveImplementabilityText = () => {
        // paper.implementabilityStatus holds backend values like 'confirmed_implementable', 'confirmed_not_implementable', 'voting'
        switch (paper.implementabilityStatus) {
            case 'Admin Not Implementable':
                return 'Implementable (Admin Set)';
            case 'Admin Implementable':
                return 'Not-Implementable (Admin Set)';
            case 'voting':
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
                        onClick={() => handleImplementabilityAction('voting')}
                        // Compare paper.implementabilityStatus (backend value) with the corresponding backend string literal
                        disabled={isUpdatingStatus || paper.implementabilityStatus === 'voting'}
                    >
                        {isUpdatingStatus && actionClicked === 'voting' ? 'Processing...' : 'Revert to Voting'}
                    </button>
                    <p className="warning-text">
                        Current status: {getEffectiveImplementabilityText()}
                        <br />
                        Force or lock implementability status, or revert to community voting.
                    </p>
                </div>

                <div className="owner-action-group">
                    <h4>Paper Implementation Status</h4>
                    <button
                        className={`btn button-secondary ${getStatusClass('Not Started')}`}
                        onClick={() => handleUpdatePaperStatus('Not Started')}
                        disabled={isUpdatingImplStatus || paper.status === 'Not Started'}
                    >
                        {isUpdatingImplStatus && paper.status !== 'Not Started' ? 'Processing...' : 'Mark as Not Started'}
                    </button>
                    <button
                        className={`btn button-secondary ${getStatusClass('Work in Progress')}`}
                        onClick={() => handleUpdatePaperStatus('Work in Progress')}
                        disabled={isUpdatingImplStatus || paper.status === 'Work in Progress'}
                    >
                        {isUpdatingImplStatus && paper.status !== 'Work in Progress' ? 'Processing...' : 'Mark as In Progress'}
                    </button>
                    <button
                        className={`btn button-success ${getStatusClass('Completed')}`}
                        onClick={() => handleUpdatePaperStatus('Completed')}
                        disabled={isUpdatingImplStatus || paper.status === 'Completed'}
                    >
                        {isUpdatingImplStatus && paper.status !== 'Completed' ? 'Processing...' : 'Mark as Completed'}
                    </button>
                </div>
                
                <div className="owner-action-group">
                    <h4>Remove Paper</h4>
                    <button 
                        className="btn button-danger" 
                        onClick={openConfirmRemoveModal}
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
