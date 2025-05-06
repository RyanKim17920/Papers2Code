// filepath: c:\Users\ilove\CODING\Papers-2-code\papers2code-ui\src\components\PaperDetailComponents\PaperImplementabilityTab.tsx
import React, { useState } from 'react';
import { Paper, PaperActionUsers, PaperNonImplementableStatus } from '../../types/paperTypes';
import { UserProfile } from '../../services/auth';
import UserDisplayList from './UserDisplayList';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmationModal from '../ConfirmationModal';
import { FaThumbsUp, FaThumbsDown, FaUndo } from 'react-icons/fa'; // Example icons

interface PaperImplementabilityTabProps {
    paper: Paper;
    currentUser: UserProfile | null;
    isUpdatingStatus: boolean;
    actionUsers: PaperActionUsers | null;
    isLoadingActionUsers: boolean;
    actionUsersError: string | null;
    onImplementabilityAction: (action: 'confirm' | 'dispute' | 'retract') => Promise<void>; // Make async if needed
}

const PaperImplementabilityTab: React.FC<PaperImplementabilityTabProps> = ({
    paper,
    currentUser,
    isUpdatingStatus,
    actionUsers,
    isLoadingActionUsers,
    actionUsersError,
    onImplementabilityAction
}) => {
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [showRetractModal, setShowRetractModal] = useState(false);
    const [showVotersModal, setShowVotersModal] = useState<'confirmations' | 'disputes' | null>(null);

    const isOwner = currentUser?.id === paper.submitter?.id;
    const isAdmin = currentUser?.is_admin;

    const hasConfirmed = currentUser && actionUsers?.confirmations?.some(u => u.id === currentUser.id);
    const hasDisputed = currentUser && actionUsers?.disputes?.some(u => u.id === currentUser.id);
    const canVote = currentUser && !isOwner && !isAdmin; // Owners/Admins use Details tab actions

    const confirmationsCount = actionUsers?.confirmations?.length ?? 0;
    const disputesCount = actionUsers?.disputes?.length ?? 0;

    const handleAction = async (action: 'confirm' | 'dispute' | 'retract') => {
        await onImplementabilityAction(action);
        // Close any modals that might have triggered this
        setShowConfirmModal(false);
        setShowDisputeModal(false);
        setShowRetractModal(false);
    };

    const getStatusExplanation = (status: PaperNonImplementableStatus) => {
        switch (status) {
            case 'implementable':
                return "This paper is currently considered implementable. If you disagree after trying to implement it, you can vote below.";
            case 'flagged':
                return "This paper has been flagged by its owner or an admin as potentially non-implementable. You can vote to confirm or dispute this status.";
            case 'confirmed':
                return "This paper has been confirmed as non-implementable by the owner/admin, likely based on community votes or review. You can vote to dispute this if you believe it's incorrect.";
            default:
                return "";
        }
    };

    const renderVoteButtons = () => {
        if (!currentUser) {
            return <p><small>Please log in to vote on implementability.</small></p>;
        }
        if (isOwner || isAdmin) {
             return <p><small>Owners and Admins manage status via the Details tab.</small></p>;
        }

        // If user has already voted (confirmed or disputed)
        if (hasConfirmed || hasDisputed) {
            return (
                <div className="voted-actions">
                    <p>You have voted: <strong>{hasConfirmed ? 'Confirmed Non-Implementable' : 'Disputed Non-Implementable'}</strong></p>
                    <button
                        onClick={() => setShowRetractModal(true)}
                        disabled={isUpdatingStatus}
                        className="button-link retract-vote-button"
                    >
                        <FaUndo /> Retract My Vote
                    </button>
                </div>
            );
        }

        // If user hasn't voted yet
        return (
            <div className="voting-buttons">
                <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={isUpdatingStatus}
                    className={`vote-button thumbs-down ${hasConfirmed ? 'voted' : ''}`}
                    title="Vote to confirm this paper is non-implementable"
                >
                    <FaThumbsDown />
                    <span>Confirm Non-Implementable</span>
                    <span
                        className={`vote-count ${confirmationsCount > 0 ? 'clickable' : ''}`}
                        onClick={confirmationsCount > 0 ? () => setShowVotersModal('confirmations') : undefined}
                        title={confirmationsCount > 0 ? "View users who confirmed" : undefined}
                    >
                        {confirmationsCount}
                    </span>
                </button>
                <button
                    onClick={() => setShowDisputeModal(true)}
                    disabled={isUpdatingStatus}
                    className={`vote-button thumbs-up ${hasDisputed ? 'voted' : ''}`}
                    title="Vote to dispute the non-implementable status (i.e., you think it IS implementable)"
                >
                    <FaThumbsUp />
                    <span>Dispute Non-Implementable</span>
                     <span
                        className={`vote-count ${disputesCount > 0 ? 'clickable' : ''}`}
                        onClick={disputesCount > 0 ? () => setShowVotersModal('disputes') : undefined}
                        title={disputesCount > 0 ? "View users who disputed" : undefined}
                    >
                        {disputesCount}
                    </span>
                </button>
            </div>
        );
    };

    return (
        <div className="tab-pane-container implementability-tab">
            <div className="implementability-explanation">
                <h4>Current Status: {paper.nonImplementableStatus.charAt(0).toUpperCase() + paper.nonImplementableStatus.slice(1)}</h4>
                <p>{getStatusExplanation(paper.nonImplementableStatus)}</p>
            </div>

            <div className="tab-action-area">
                {renderVoteButtons()}
                {isUpdatingStatus && <small className="loading-inline">Processing vote...</small>}
            </div>

            {isLoadingActionUsers && <LoadingSpinner size="small" />}
            {actionUsersError && <p className="error-message">Error loading votes: {actionUsersError}</p>}

            {!isLoadingActionUsers && !actionUsersError && (
                <div className="implementability-lists-container">
                    {/* Optionally always show lists, or only if > 0 */}
                    <div className="implementability-list-column">
                        <UserDisplayList
                            users={actionUsers?.confirmations || []}
                            title={`Confirmations (${confirmationsCount})`}
                            emptyMessage="No confirmations yet."
                        />
                    </div>
                     <div className="implementability-list-column">
                        <UserDisplayList
                            users={actionUsers?.disputes || []}
                            title={`Disputes (${disputesCount})`}
                            emptyMessage="No disputes yet."
                        />
                    </div>
                </div>
            )}

            {/* Confirmation Modals */}
            {showConfirmModal && (
                <ConfirmationModal
                    title="Confirm Non-Implementable?"
                    message="Are you sure you want to vote that this paper lacks sufficient detail for implementation?"
                    confirmText="Yes, Confirm"
                    cancelText="Cancel"
                    onConfirm={() => handleAction('confirm')}
                    onCancel={() => setShowConfirmModal(false)}
                    confirmButtonVariant="danger"
                />
            )}
            {showDisputeModal && (
                <ConfirmationModal
                    title="Dispute Non-Implementable?"
                    message="Are you sure you want to vote that this paper IS implementable (disputing the non-implementable status)?"
                    confirmText="Yes, Dispute"
                    cancelText="Cancel"
                    onConfirm={() => handleAction('dispute')}
                    onCancel={() => setShowDisputeModal(false)}
                    confirmButtonVariant="success" // Or primary
                />
            )}
            {showRetractModal && (
                <ConfirmationModal
                    title="Retract Your Vote?"
                    message="Are you sure you want to retract your vote on the implementability status of this paper?"
                    confirmText="Yes, Retract Vote"
                    cancelText="Cancel"
                    onConfirm={() => handleAction('retract')}
                    onCancel={() => setShowRetractModal(false)}
                    confirmButtonVariant="secondary"
                />
            )}

            {/* Modal to show voters (using UserDisplayList inside a modal) */}
            {showVotersModal && (
                 <ConfirmationModal // Reusing modal structure, but could be a dedicated InfoModal
                    title={showVotersModal === 'confirmations' ? "Users Who Confirmed" : "Users Who Disputed"}
                    onCancel={() => setShowVotersModal(null)} // Only needs a close/cancel action
                    hideConfirmButton={true} // Hide the default confirm button
                    cancelText="Close"
                 >
                    <UserDisplayList
                        users={showVotersModal === 'confirmations' ? (actionUsers?.confirmations || []) : (actionUsers?.disputes || [])}
                        title="" // Title is handled by modal
                        emptyMessage="No users found."
                    />
                 </ConfirmationModal>
            )}
        </div>
    );
};

export default PaperImplementabilityTab;
