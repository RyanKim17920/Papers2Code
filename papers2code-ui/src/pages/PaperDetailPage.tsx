import React from 'react';
import { useParams, Link } from 'react-router-dom';

import { usePaperDetail } from '../hooks/usePaperDetail';
import type { ActiveTab as ActiveTabType } from '../hooks/usePaperDetail';
import { UserProfile } from '../services/auth';
import type { OwnerSettableImplementabilityStatus } from '../types/paper';

import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/common/ConfirmationModal';

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

    const {
        paper,
        isLoading,
        error,
        updateError,
        isRemoving,
        isUpdatingStatus,
        isVoting,
        activeTab,
        setActiveTab,
        actionUsers,
        isLoadingActionUsers,
        actionUsersError,
        handleUpvote,
        handleImplementabilityVote,
        handleSetImplementabilityStatus,
        handleRemovePaper,
        showConfirmRemoveModal,
        showConfirmStatusModal,
        openConfirmRemoveModal,
        openConfirmStatusModal,
        closeConfirmRemoveModal,
        closeConfirmStatusModal,
        reloadPaper,
        setUpdateError, // Added setUpdateError to destructuring
    } = usePaperDetail(paperId, currentUser);
    console.log(paper)
    // Determine if the current user is an admin
    const isAdminView = (currentUser?.isAdmin === true || currentUser?.isOwner == true);

    const handleStepUpdate = async () => {
        await reloadPaper();
    };

    const handleSetActiveTab = (tab: string) => {
        setActiveTab(tab as ActiveTabType);
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

    return (
        <div className="paper-detail-page">
            <Link to="/" className="back-link">Back to List</Link>

            {updateError && <div className="update-error">{updateError}</div>}
            <h1>{paper.title}</h1>

            <ImplementabilityNotice paper={paper} />

            <PaperTabs
                activeTab={activeTab}
                setActiveTab={handleSetActiveTab}
                paper={paper}
                isOwner={isAdminView} // Pass isAdminView as isOwner to PaperTabs
            />

            <div className="tab-content">
                {activeTab === 'paperInfo' && (
                    <div className="tab-pane-container">
                        <PaperMetadata paper={paper} />
                        <PaperAbstract abstract={paper.abstract} />
                    </div>
                )}

                {activeTab === 'details' && (
                    <DetailsTab paper={paper} onStepUpdate={handleStepUpdate} />
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
                            onPaperUpdate={reloadPaper}
                            setUpdateError={setUpdateError}
                            openConfirmStatusModal={openConfirmStatusModal as (status: OwnerSettableImplementabilityStatus) => void}
                            openConfirmRemoveModal={openConfirmRemoveModal}
                            isUpdatingStatus={isUpdatingStatus}
                            isRemoving={isRemoving}
                        />
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={showConfirmRemoveModal}
                onClose={closeConfirmRemoveModal}
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
                onClose={closeConfirmStatusModal}
                onConfirm={() => showConfirmStatusModal.status && handleSetImplementabilityStatus(showConfirmStatusModal.status as OwnerSettableImplementabilityStatus)}
                title={`Confirm Status: ${
                    (showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_implementable' ? 'Implementable' :
                    (showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_non_implementable' ? 'Non-Implementable' :
                    'Revert to Voting'
                }`}
                confirmText={`Yes, ${
                    (showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_implementable' ? 'Confirm Implementable' :
                    (showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_non_implementable' ? 'Confirm Non-Implementable' :
                    'Revert to Voting'
                }`}
                confirmButtonClass={
                    (showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_implementable' ? 'button-secondary' :
                    (showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_non_implementable' ? 'button-warning' :
                    'button-secondary'
                }
                isConfirming={isUpdatingStatus}
            >
                {(showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_implementable' && (
                    <p>Are you sure you want to set the status to <strong>Confirmed Implementable</strong>? Community voting will be disabled.</p>
                )}
                {(showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'confirmed_non_implementable' && (
                    <p>Are you sure you want to set the status to <strong>Confirmed Non-Implementable</strong>? Community voting will be disabled.</p>
                )}
                {(showConfirmStatusModal.status as OwnerSettableImplementabilityStatus) === 'voting' && (
                    <p>Are you sure you want to revert to <strong>community voting</strong>? Community voting will be re-enabled.</p>
                )}
            </ConfirmationModal>
        </div>
    );
};

export default PaperDetailPage;