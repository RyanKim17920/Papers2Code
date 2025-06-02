import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { usePaperDetail } from '../hooks/usePaperDetail';
import type { ActiveTab as ActiveTabType, AdminSettableImplementabilityStatus } from '../hooks/usePaperDetail';
import { UserProfile } from '../services/auth';

import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/common/ConfirmationModal'; // Standardized import

import PaperMetadata from '../components/PaperDetailComponents/Tabs/Paper/PaperMetadata';
import PaperAbstract from '../components/PaperDetailComponents/Tabs/Paper/PaperAbstract';
import ImplementabilityNotice from '../components/PaperDetailComponents/Tabs/Implementation/ImplementabilityNotice';
import PaperTabs from '../components/PaperDetailComponents/PaperTabs';
import DetailsTab from '../components/PaperDetailComponents/Tabs/Implementation/DetailsTab';
import { UpvotesTab } from '../components/PaperDetailComponents/Tabs/Upvote/UpvotesTab'; // Named import
import { ImplementabilityTab } from '../components/PaperDetailComponents/Tabs/Implementation/ImplementabilityTab'; // Named import
import { OwnerActions } from '../components/PaperDetailComponents/Tabs/Admin/OwnerActions'; // Named import
import './PaperDetailPage.css';

interface PaperDetailPageProps {
    currentUser: UserProfile | null;
}

const PaperDetailPage: React.FC<PaperDetailPageProps> = ({ currentUser }) => {
    const { paperId } = useParams<{ paperId: string }>();
    const [showStartEffortConfirmModal, setShowStartEffortConfirmModal] = useState<boolean>(false); // New state for the modal

    const {
        paper,
        isLoading,
        error,
        updateError,
        activeTab,
        setActiveTab,
        handleUpvote,
        handleImplementabilityVote,
        handleSetImplementabilityStatus,
        handleRemovePaper,
        showConfirmRemoveModal,
        setShowConfirmRemoveModal,
        showConfirmStatusModal,
        setShowConfirmStatusModal,
        openConfirmStatusModal,
        isRemoving,
        isUpdatingStatus,
        isVoting,
        actionUsers,
        isLoadingActionUsers,
        actionUsersError,
        loadPaperAndActions, 
        handleInitiateJoinImplementationEffort, 
        isProcessingEffortAction,          
        effortActionError
    } = usePaperDetail(paperId, currentUser);

    const isAdminView = (currentUser?.isAdmin === true || currentUser?.isOwner == true);

    const handleSetActiveTab = (tab: string) => {
        setActiveTab(tab as ActiveTabType);
    };

    // Modified to show confirmation modal first
    const handleInitiateImplementationEffort = () => {
        if (!paperId || !currentUser) {
            console.warn("Paper ID or user not available for initiating implementation effort.");
            // Consider using a more integrated notification system if available
            alert("You must be logged in to perform this action.");
            return;
        }
        setShowStartEffortConfirmModal(true); // Show the confirmation modal
    };

    const confirmAndStartEffort = () => {
        handleInitiateJoinImplementationEffort(); // Call the function from the hook
        setShowStartEffortConfirmModal(false);    // Close modal
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <div className="error-message">Error loading paper: {error}</div>;
    }

    if (!paper) {
        return <div className="error-message">Paper not found or failed to load.</div>;
    }

    const isCurrentUserContributor = paper.implementationProgress?.contributors?.some(
        (contributorId) => contributorId === currentUser?.id
    );

    return (
        <div className="paper-detail-page">
            <Link to="/" className="back-link">Back to List</Link>

            {updateError && <div className="update-error">{updateError}</div>}
            <h1>{paper.title}</h1>

            <ImplementabilityNotice paper={paper} />

            {/* --- Community Implementation Effort Section --- */}
            {currentUser && paper && !isCurrentUserContributor && (
                <div className="implementation-effort-section">
                    <h4>Community Implementation Progress</h4>
                    {paper.implementationProgress ? (
                        <>
                            <p>A community effort to implement this paper is active or has been initiated.</p>
                            {/* Button to View or Join Effort - uses the same handler for now, which will show the modal */}
                            {/* Consider if "View or Join Effort" should bypass this specific confirmation if an effort already exists */}
                            <button 
                                onClick={handleInitiateImplementationEffort} 
                                className="button-secondary" 
                                disabled={isProcessingEffortAction} 
                            >
                                View or Join Effort
                            </button>
                        </>
                    ) : (
                        <>
                            <p>Be the first to lead or join a community effort to implement this paper!</p>
                            <button 
                                onClick={handleInitiateImplementationEffort} // This will now open the modal
                                className="button-secondary" 
                                disabled={isProcessingEffortAction} 
                            >
                                Start Implementation Effort
                            </button>
                        </>
                    )}
                    {effortActionError && <div className="error-message">{effortActionError}</div>}
                    {updateError && !effortActionError && <div className="error-message">{updateError}</div>} 
                </div>
            )}

            <PaperTabs
                activeTab={activeTab}
                onSelectTab={handleSetActiveTab}
                paper={paper}
                isAdminView={isAdminView}
            />

            {showConfirmRemoveModal && (
                <ConfirmationModal // Standardized to ConfirmationModal
                    isOpen={showConfirmRemoveModal}
                    onClose={() => setShowConfirmRemoveModal(false)}
                    onConfirm={handleRemovePaper}
                    title="Confirm Removal"
                    confirmText="Remove"
                    confirmButtonClass="button-danger"
                    isConfirming={isRemoving}
                >
                    <p>Are you sure you want to remove this paper? This action cannot be undone.</p>
                </ConfirmationModal>
            )}

            {showConfirmStatusModal.show && showConfirmStatusModal.status && (
                <ConfirmationModal // Standardized to ConfirmationModal
                    isOpen={showConfirmStatusModal.show}
                    onClose={() => setShowConfirmStatusModal({ show: false, status: null })}
                    onConfirm={() => handleSetImplementabilityStatus(showConfirmStatusModal.status!)}
                    title="Confirm Status Change"
                    confirmText="Confirm Status"
                    isConfirming={isUpdatingStatus}
                >
                    <p>{`Are you sure you want to set the status to "${showConfirmStatusModal.status}"?`}</p>
                </ConfirmationModal>
            )}

            <div className="tab-content">
                {activeTab === 'paperInfo' && (
                    <div className="tab-pane-container">
                        <PaperMetadata paper={paper} />
                        <PaperAbstract abstract={paper.abstract} />
                    </div>
                )}

                {activeTab === 'details' && (
                    <DetailsTab paper={paper} onStepUpdate={loadPaperAndActions} /> 
                )}

                {activeTab === 'upvotes' && (
                    <UpvotesTab
                        paper={paper}
                        currentUser={currentUser}
                        isVoting={isVoting}
                        handleUpvote={handleUpvote}
                        actionUsers={actionUsers}
                        isLoadingActionUsers={isLoadingActionUsers}
                        actionUsersError={actionUsersError}
                    />
                )}

                {activeTab === 'implementability' && (
                    <ImplementabilityTab
                        paper={paper}
                        currentUser={currentUser}
                        isVoting={isVoting}
                        handleImplementabilityVote={handleImplementabilityVote}
                        actionUsers={actionUsers}
                        isLoadingActionUsers={isLoadingActionUsers}
                        actionUsersError={actionUsersError}
                    />
                )}

                {activeTab === 'admin' && isAdminView && ( // Use isAdminView here
                    <div className="tab-pane-container">
                        <OwnerActions
                            paper={paper}
                            currentUser={currentUser}
                            onPaperUpdate={loadPaperAndActions}
                            openConfirmStatusModal={openConfirmStatusModal as (status: AdminSettableImplementabilityStatus) => void}
                            onRequestRemoveConfirmation={() => setShowConfirmRemoveModal(true)} // Pass handler for new prop
                            isUpdatingStatus={isUpdatingStatus}
                            isRemoving={isRemoving}
                        />
                    </div>
                )}
            </div>

            {/* New Confirmation Modal for Starting/Joining Effort */}
            {showStartEffortConfirmModal && (
                <ConfirmationModal
                    isOpen={showStartEffortConfirmModal}
                    onClose={() => setShowStartEffortConfirmModal(false)}
                    onConfirm={confirmAndStartEffort} // Use the new wrapper function
                    title="Confirm Start Implementation Effort"
                    confirmText="Yes, Start Effort"
                    isConfirming={isProcessingEffortAction} 
                >
                    <p>Starting an implementation effort indicates this paper is considered implementable, you will work on it, and community implementability voting will be superseded.</p>
                    <p>Do you want to proceed?</p>
                </ConfirmationModal>
            )}

            <ConfirmationModal
                isOpen={showConfirmRemoveModal}
                onClose={() => setShowConfirmRemoveModal(false)}
                onConfirm={handleRemovePaper}
                title="Confirm Paper Removal"
                confirmText="Yes, Remove Paper"
                confirmButtonClass="button-danger"
                isConfirming={isRemoving}
            >
                <p>Are you sure you want to permanently remove this paper?</p>
                <p><strong>Title:</strong> {paper.title}</p>
                <p>This action cannot be undone.</p>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={showConfirmStatusModal.show}
                onClose={() => setShowConfirmStatusModal({ show: false, status: null })}
                onConfirm={() => showConfirmStatusModal.status && handleSetImplementabilityStatus(showConfirmStatusModal.status as AdminSettableImplementabilityStatus)}
                title={`Confirm Status: ${
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' ? 'Implementable' :
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' ? 'Not-Implementable' :
                    'Revert to Voting'
                }`}
                confirmText={`Yes, ${
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' ? 'Confirm Implementable' :
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' ? 'Confirm Not-Implementable' :
                    'Revert to Voting'
                }`}
                confirmButtonClass={
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' ? 'button-secondary' :
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' ? 'button-warning' :
                    'button-secondary'
                }
                isConfirming={isUpdatingStatus}
            >
                {(showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' && (
                    <p>Are you sure you want to set the status to <strong>Confirmed Implementable</strong>? Community voting will be disabled.</p>
                )}
                {(showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' && (
                    <p>Are you sure you want to set the status to <strong>Confirmed Not-Implementable</strong>? Community voting will be disabled.</p>
                )}
                {(showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Voting' && (
                    <p>Are you sure you want to revert to <strong>community voting</strong>? Community voting will be re-enabled.</p>
                )}
            </ConfirmationModal>
        </div>
    );
};

export default PaperDetailPage;