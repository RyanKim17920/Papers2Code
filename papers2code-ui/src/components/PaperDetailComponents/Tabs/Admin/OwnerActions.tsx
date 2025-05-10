import React, { useState } from 'react'; // Added useState
import { Paper } from '../../../../types/paper'; // Corrected import path
import { UserProfile } from '../../../../services/auth'; // Corrected import path
import { updatePaperStatusInApi } from '../../../../services/api'; // Changed from apiService to a direct import
import { getStatusClass } from '../../../../utils/statusUtils'; // Import shared getStatusClass
import './OwnerActions.css';

interface OwnerActionsProps {
    paper: Paper;
    currentUser: UserProfile | null;
    onPaperUpdate: (updatedPaper: Paper) => void;
    setUpdateError: (error: string | null) => void;
    openConfirmStatusModal: (status: 'confirmed_non_implementable' | 'implementable') => void;
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
    isUpdatingStatus, // This is for implementability status (e.g., confirm non-implementable)
    isRemoving
}) => {
    // New state for implementation status updates (Not Started, In Progress, Completed)
    const [isUpdatingImplStatus, setIsUpdatingImplStatus] = useState<boolean>(false);

    const handleUpdatePaperStatus = async (status: string) => {
        if (!currentUser || !paper.id) return; // Keep basic guard for currentUser and paper.id
        setIsUpdatingImplStatus(true); // Set loading for implementation status update
        setUpdateError(null);
        try {
            // Changed from apiService.updatePaperStatus to updatePaperStatusInApi
            const updatedPaper = await updatePaperStatusInApi(paper.id, status, currentUser.id);
            if (updatedPaper) {
                onPaperUpdate(updatedPaper);
            }
        } catch (err) {
            // Type assertion for err if specific error structure is known, otherwise use Error
            if (err instanceof Error) {
                setUpdateError(err.message || 'Failed to update paper status');
            } else {
                setUpdateError('An unknown error occurred while updating paper status');
            }
        } finally {
            setIsUpdatingImplStatus(false); // Clear loading for implementation status update
        }
    };

    return (
        <div className="paper-actions">
            <div className="privileged-actions">
                <h3>Owner Actions (Danger Zone)</h3>

                <div className="owner-action-group">
                    <h4>Implementability Status Management</h4>
                    {paper.nonImplementableStatus === 'flagged_non_implementable' && (
                        <button
                            className="btn button-warning"
                            onClick={() => openConfirmStatusModal('confirmed_non_implementable')}
                            disabled={isUpdatingStatus}
                        >
                        </button>
                    )}
                    {(paper.nonImplementableStatus === 'flagged_non_implementable' || paper.nonImplementableStatus === 'confirmed_non_implementable') && (
                        <button
                            className="btn button-secondary"
                            onClick={() => openConfirmStatusModal('implementable')}
                            disabled={isUpdatingStatus}
                        >
                            {isUpdatingStatus ? 'Processing...' : 'Revert to Implementable'}
                        </button>
                    )}
                    {paper.nonImplementableStatus !== 'flagged_non_implementable' && paper.nonImplementableStatus !== 'confirmed_non_implementable' && (
                        <p>No pending implementability flags to action for confirmation/reversion.</p>
                    )}
                    <p className="warning-text">
                        Confirming makes it non-implementable. Reverting makes it implementable again.
                    </p>
                </div>

                <div className="owner-action-group">
                    <h4>Paper Implementation Status</h4>
                    <button
                        className={`btn button-secondary ${getStatusClass('Not Started')}`}
                        onClick={() => handleUpdatePaperStatus('Not Started')}
                        disabled={isUpdatingImplStatus || paper.implementationStatus === 'Not Started'}
                    >
                        {isUpdatingImplStatus && paper.implementationStatus !== 'Not Started' ? 'Processing...' : 'Mark as Not Started'}
                    </button>
                    <button
                        className={`btn button-secondary ${getStatusClass('In Progress')}`}
                        onClick={() => handleUpdatePaperStatus('In Progress')}
                        disabled={isUpdatingImplStatus || paper.implementationStatus === 'In Progress'}
                    >
                        {isUpdatingImplStatus && paper.implementationStatus !== 'In Progress' ? 'Processing...' : 'Mark as In Progress'}
                    </button>
                    <button
                        className={`btn button-success ${getStatusClass('Completed')}`}
                        onClick={() => handleUpdatePaperStatus('Completed')}
                        disabled={isUpdatingImplStatus || paper.implementationStatus === 'Completed'}
                    >
                        {isUpdatingImplStatus && paper.implementationStatus !== 'Completed' ? 'Processing...' : 'Mark as Completed'}
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
