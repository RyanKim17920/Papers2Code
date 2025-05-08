import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaThumbsUp, FaThumbsDown, FaArrowUp } from 'react-icons/fa'; // Keep icons needed directly here or move to specific components

import { usePaperDetail } from '../hooks/usePaperDetail'; // Import the new hook
import { UserProfile } from '../services/auth';
import { Author } from '../types/paper'; // Import Author type

import LoadingSpinner from '../components/LoadingSpinner';
import ProgressTracker from '../components/PaperDetailComponents/ProgressTracker'; // Keep if used in DetailsTab
import UserDisplayList from '../components/PaperDetailComponents/UserDisplayList'; // Import moved component
import ConfirmationModal from '../components/common/ConfirmationModal'; // Import modal

// Placeholder imports for components to be created
// import PaperMetadata from '../components/PaperDetailComponents/PaperMetadata';
// import PaperAbstract from '../components/PaperDetailComponents/PaperAbstract';
// import ImplementabilityNotice from '../components/PaperDetailComponents/ImplementabilityNotice';
// import PaperTabs from '../components/PaperDetailComponents/PaperTabs';
// import DetailsTab from '../components/PaperDetailComponents/DetailsTab';
// import UpvotesTab from '../components/PaperDetailComponents/UpvotesTab';
// import ImplementabilityTab from '../components/PaperDetailComponents/ImplementabilityTab';
// import OwnerActions from '../components/PaperDetailComponents/OwnerActions';

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
        reloadPaper // Get reload function from hook
    } = usePaperDetail(paperId, currentUser);

    // --- Helper Functions (Can be moved to utils if complex) ---
    console.log("currentUser:", currentUser);
    console.log("paper:", paper);
    console.log("paper?.ownerId:", paper?.ownerId);
    console.log("currentUser?.id:", currentUser?.id);
    console.log("IDs match:", paper?.ownerId === currentUser?.id);

    const isOwner = currentUser?.isOwner ?? false; // Handle potential null currentUser

    const getStatusClass = (status: string | undefined | null): string => { // Allow null
        // Simplified example - move to utils or keep if simple
        if (!status) return 'status-default';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('progress')) return 'status-in-progress';
        if (lowerStatus.includes('completed')) return 'status-completed';
        if (lowerStatus.includes('non-implementable')) return 'status-non-implementable';
        return 'status-default';
    };

    const handleStepUpdate = async () => {
        // Reload paper data after a step update
        await reloadPaper();
    };

    // --- Render Logic ---
    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <div className="error-message">Error loading paper: {error}</div>;
    }

    if (!paper) {
        return <div className="error-message">Paper not found or failed to load.</div>;
    }

    // --- Render Page Content ---
    return (
        <div className="paper-detail-page">
            <Link to="/" className="back-link">Back to List</Link>

            {updateError && <div className="update-error">{updateError}</div>}
            <h1>{paper.title}</h1>

            {/* Implementability Notice Section */}
            {paper.nonImplementableStatus === 'confirmed_non_implementable' && (
                    <div className="not-implementable-notice confirmed">
                        <strong>Confirmed Non-Implementable</strong> by {paper.nonImplementableConfirmedBy || 'unknown'}.
                        This paper has been confirmed as not suitable for implementation on this platform.
                    </div>
                )}
                {paper.nonImplementableStatus === 'flagged_non_implementable' && (
                        <div className="not-implementable-notice flagged">
                        <p><strong>Flagged as Potentially Non-Implementable</strong></p>
                        <p>
                            {paper.nonImplementableVotes} user(s) flagged this <FaThumbsUp />, {paper.disputeImplementableVotes} user(s) disagree <FaThumbsDown />.
                            The owner can confirm or revert this status.
                        </p>
                    </div>
                )}
                    {paper.nonImplementableStatus === 'implementable' && paper.isImplementable === false && (
                        <div className="implementable-notice">
                        This paper was previously flagged or confirmed as non-implementable, but the status has been reverted. It is currently considered implementable.
                    </div>
                )}
             {/* === Tabs Section === */}
             <div className="paper-tabs">
                 <button
                    className={`tab-button ${activeTab === 'paperInfo' ? 'active' : ''}`}
                    onClick={() => setActiveTab('paperInfo')}
                >
                    Paper Information
                </button>
                <button
                    className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                >
                    Implementation Details
                </button>
                <button
                    className={`tab-button ${activeTab === 'upvotes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upvotes')}
                >
                    Upvotes ({paper.upvoteCount ?? 0})
                </button>
                 <button
                    className={`tab-button ${activeTab === 'implementability' ? 'active' : ''}`}
                    onClick={() => setActiveTab('implementability')}
                >
                    Implementability Votes ({paper.nonImplementableVotes + paper.disputeImplementableVotes})
                </button>
                {isOwner && (
                    <button
                        className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                        onClick={() => setActiveTab('admin')}
                    >
                        Admin Actions 
                    </button>
                )}
            </div>
            {/* === End Tabs Section === */}


            {/* === Tab Content Section === */}
            <div className="tab-content">

                {/* Paper Information Tab */}
                {activeTab === 'paperInfo' && (
                     <div className="tab-pane-container">
                        {/* Metadata Section */}
                        <div className="paper-meta">
                            
                            <p>
                                <strong>Authors:</strong> {paper.authors?.map((a: Author) => a.name).join(', ') || 'N/A'}
                            </p>
                            <p>
                                <strong>Date:</strong> {paper.date ? new Date(paper.date).toLocaleDateString() : 'N/A'}
                                {paper.proceeding && <span> | <strong>Proceeding:</strong> {paper.proceeding}</span>}
                            </p>
                            {paper.arxivId && <p><strong>ArXiv ID:</strong> {paper.arxivId}</p>}
                            <p>
                                {paper.urlAbs && <a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">Abstract Link</a>}
                                {paper.urlPdf && <> | <a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">PDF Link</a></>}
                                {paper.pwcUrl && <> | <a href={paper.pwcUrl} target="_blank" rel="noopener noreferrer">PapersWithCode</a></>}
                            </p>
                            {paper.tasks && paper.tasks.length > 0 && (<p><strong>Tasks:</strong> {paper.tasks.join(', ')}</p>)}
                            <p>
                                <strong>Status:</strong>
                                <span className={`status ${getStatusClass(paper.implementationStatus)}`}>
                                    {paper.implementationStatus || 'Unknown'}
                                </span>
                            </p>
                            <p>
                                <strong>Upvotes:</strong> {paper.upvoteCount}
                            </p>
                             
                        </div>

                        

                        {/* Abstract Section */}
                        <div className="paper-abstract">
                            <h3>Abstract</h3>
                            <p>{paper.abstract || 'Abstract not available.'}</p>
                        </div>
                    </div>
                )}

                {/* Implementation Details Tab */}
                {activeTab === 'details' && (
                    <div className="tab-pane-container">
                        <ProgressTracker
                            steps={paper.implementationSteps || []}
                            paperId={String(paper.id)} // Convert number to string
                            onStepUpdate={handleStepUpdate} // Pass update handler
                         />
                        {/* Add other details content here, e.g., implementation notes */}
                         {paper.implementationNotes && (
                            <div className="implementation-notes">
                                <h4>Notes:</h4>
                                <p>{paper.implementationNotes}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Upvotes Tab */}
                {activeTab === 'upvotes' && (
                    <div className="tab-pane-container">
                        <h3>Upvotes</h3>
                        <div className="tab-action-area">
                             {currentUser ? (
                                <>
                                    <button
                                        className={`vote-button upvote-tab ${paper.currentUserVote === 'up' ? 'voted' : ''}`}
                                        onClick={() => handleUpvote(paper.currentUserVote === 'up' ? 'none' : 'up')}
                                        disabled={isVoting}
                                    >
                                        <FaArrowUp />
                                        <span>{paper.currentUserVote === 'up' ? 'Upvoted' : 'Upvote'}</span>
                                        <span className="vote-count">{paper.upvoteCount}</span>
                                    </button>
                                    {paper.currentUserVote === 'up' && (
                                        <button className="button-link retract-vote-button" onClick={() => handleUpvote('none')} disabled={isVoting}>
                                            Retract Vote
                                        </button>
                                    )}
                                </>
                            ) : (
                                <p>Please log in to upvote.</p>
                            )}
                        </div>
                         <UserDisplayList
                            title="Upvoted By"
                            users={actionUsers?.upvotes} // Corrected property name
                            isLoading={isLoadingActionUsers}
                            error={actionUsersError}
                            emptyMessage="No upvotes yet."
                        />
                    </div>
                )}

                {/* Implementability Votes Tab */}
                {activeTab === 'implementability' && (
                    <div className="tab-pane-container">
                         <h3>Implementability Voting</h3>
                        <div className="implementability-explanation">
                            <h4>Community Voting: Is this paper implementable?</h4>
                            <p>
                                Use <FaThumbsUp color="var(--success-color)" /> if you think this paper <strong>cannot</strong> be reasonably implemented (e.g., requires unavailable hardware, data, or is underspecified).
                                Use <FaThumbsDown color="var(--danger-color)" /> if you disagree with a non-implementable flag.
                                The paper admins can confirm the status based on community feedback.
                            </p>
                        </div>
                        <div className="tab-action-area">
                             {currentUser ? (
                                <>
                                    <button
                                        className={`vote-button thumbs-up ${paper.currentUserImplementabilityVote === 'up' ? 'voted' : ''}`}
                                        onClick={() => handleImplementabilityVote(paper.currentUserImplementabilityVote === 'up' ? 'retract' : 'confirm')} // Use 'confirm' for flag
                                        disabled={isVoting || paper.nonImplementableStatus === 'confirmed_non_implementable'}
                                        title={paper.nonImplementableStatus === 'confirmed_non_implementable' ? "Status is confirmed" : "Vote Non-Implementable"}
                                    >
                                        <FaThumbsUp /> <span>Flag Non-Implementable</span>
                                        <span className="vote-count">{paper.nonImplementableVotes}</span>
                                    </button>
                                    <button
                                        className={`vote-button thumbs-down ${paper.currentUserImplementabilityVote === 'down' ? 'voted' : ''}`}
                                        onClick={() => handleImplementabilityVote(paper.currentUserImplementabilityVote === 'down' ? 'retract' : 'dispute')} // Use 'dispute'
                                        disabled={isVoting || paper.nonImplementableStatus === 'confirmed_non_implementable'}
                                        title={paper.nonImplementableStatus === 'confirmed_non_implementable' ? "Status is confirmed" : "Dispute Non-Implementable Flag"}
                                    >
                                        <FaThumbsDown /> <span>Dispute Flag</span>
                                        <span className="vote-count">{paper.disputeImplementableVotes}</span>
                                    </button>
                                     {paper.currentUserImplementabilityVote !== 'none' && (
                                        <button className="button-link retract-vote-button" onClick={() => handleImplementabilityVote('retract')} disabled={isVoting}> // Use 'retract'
                                            Retract Vote
                                        </button>
                                    )}
                                </>
                            ) : (
                                <p>Please log in to vote on implementability.</p>
                            )}
                        </div>
                         <div className="user-lists-grid">
                            <UserDisplayList
                                title="Flagged Non-Implementable By"
                                users={actionUsers?.confirmations} // Use correct property: confirmations
                                isLoading={isLoadingActionUsers}
                                error={actionUsersError}
                            />
                            <UserDisplayList
                                title="Disputed Flag By"
                                users={actionUsers?.disputes} // Use correct property: disputes
                                isLoading={isLoadingActionUsers}
                                error={actionUsersError}
                            />
                        </div>
                    </div>
                )}

                 {/* Owner Actions Tab */}
                 {activeTab === 'admin' && isOwner && (
                     <div className="tab-pane-container">
                        <div className="paper-actions privileged-actions">
                            <h3>Owner Actions</h3>
                             {/* Implementability Confirmation */}
                             <div className="owner-action-group">
                                <h4>Confirm Implementability Status</h4>
                                {paper.nonImplementableStatus !== 'confirmed_non_implementable' && (
                                     <button
                                        className="btn button-warning"
                                        onClick={() => openConfirmStatusModal('confirmed_non_implementable')}
                                        disabled={isUpdatingStatus}
                                    >
                                        Confirm as Non-Implementable
                                    </button>
                                )}
                                 {paper.nonImplementableStatus !== 'implementable' && (
                                     <button
                                        className="btn button-secondary"
                                        onClick={() => openConfirmStatusModal('implementable')}
                                        disabled={isUpdatingStatus}
                                    >
                                        Revert to Implementable
                                    </button>
                                )}
                                 {isUpdatingStatus && <span className="loading-inline"> Updating...</span>}
                                 <p className="warning-text">Confirming status based on community votes or owner assessment.</p>
                            </div>

                            {/* Remove Paper */}
                            <div className="owner-action-group remove-paper-action">
                                 <h4>Remove Paper</h4>
                                 <button
                                    className="btn button-danger"
                                    onClick={openConfirmRemoveModal}
                                    disabled={isRemoving}
                                >
                                    {isRemoving ? 'Removing...' : 'Remove Paper'}
                                </button>
                                <p className="warning-text">This action is permanent and cannot be undone.</p>
                            </div>
                        </div>
                    </div>
                 )}
            </div>
             {/* === End Tab Content === */}


            {/* --- Modals (remain outside tabs) --- */}
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
                onConfirm={() => {
                    if (showConfirmStatusModal.status) {
                        // Ensure conversion happens correctly
                        const shouldBeImplementable = showConfirmStatusModal.status === 'implementable';
                        handleSetImplementabilityStatus(shouldBeImplementable);
                    }
                }}
                title={`Confirm Status: ${showConfirmStatusModal.status === 'implementable' ? 'Implementable' : 'Non-Implementable'}`}
                confirmText={`Yes, Confirm ${showConfirmStatusModal.status === 'implementable' ? 'Implementable' : 'Non-Implementable'}`}
                confirmButtonClass={showConfirmStatusModal.status === 'implementable' ? 'button-secondary' : 'button-warning'}
                isConfirming={isUpdatingStatus}
            >
                <p>Are you sure you want to set the status of this paper to <strong>{showConfirmStatusModal.status === 'implementable' ? 'Implementable' : 'Confirmed Non-Implementable'}</strong>?</p>
                 {showConfirmStatusModal.status === 'confirmed_non_implementable' && <p>This indicates the paper is unsuitable for implementation on this platform.</p>}
                 {showConfirmStatusModal.status === 'implementable' && <p>This will revert any previous non-implementable flags or confirmations.</p>}
            </ConfirmationModal>

        </div>
    );
};

export default PaperDetailPage;