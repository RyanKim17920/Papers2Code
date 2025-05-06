import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Paper, ImplementationStep } from '../types/paper';
import {
    fetchPaperByIdFromApi,
    // updateStepStatusInApi, // Keep if used
    flagImplementabilityInApi,
    ImplementabilityAction,
    setImplementabilityInApi,
    removePaperFromApi,
    voteOnPaperInApi,
    fetchPaperActionUsers,
    PaperActionUsers
} from '../services/api';
import ProgressTracker from '../components/PaperDetailComponents/ProgressTracker';
import { FaThumbsUp, FaThumbsDown, FaArrowUp } from 'react-icons/fa';
import { UserProfile } from '../services/auth';
import LoadingSpinner from '../components/LoadingSpinner';
import './PaperDetailPage.css';

// --- User Display List Component (Adjusted: Removed children prop) ---
interface UserDisplayListProps {
    users: UserProfile[] | undefined;
    title: string;
    isLoading: boolean;
    error: string | null;
    // Removed children prop
}

const UserDisplayList: React.FC<UserDisplayListProps> = ({ users, title, isLoading, error }) => {
    // Removed container div, styling will be handled by parent columns
    return (
        <div className="user-display-list">
            <h3>{title} ({isLoading ? '...' : users?.length ?? 0})</h3>
            {isLoading && <LoadingSpinner />}
            {error && <p className="error-message">Error loading users: {error}</p>}
            {!isLoading && !error && (!users || users.length === 0) && (
                <p>No users found for this action.</p>
            )}
            {!isLoading && !error && users && users.length > 0 && (
                <ul>
                    {users.map(user => (
                        <li key={user.id}>
                            <img
                                src={user.avatarUrl || '/default-avatar.png'}
                                alt={user.username}
                                className="user-avatar-small"
                                onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                            />
                            <span>{user.username}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
// --- End User Display List ---

interface PaperDetailPageProps {
    currentUser: UserProfile | null;
}

// --- Update Tab Types ---
type ActiveTab = 'details' | 'upvotes' | 'implementability'; // Combined confirmations/disputes

const PaperDetailPage: React.FC<PaperDetailPageProps> = ({ currentUser }) => {
    const { paperId } = useParams<{ paperId: string }>();
    const navigate = useNavigate();
    const [paper, setPaper] = useState<Paper | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState<boolean>(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
    const [isVoting, setIsVoting] = useState<boolean>(false);

    const [activeTab, setActiveTab] = useState<ActiveTab>('details');
    const [actionUsers, setActionUsers] = useState<PaperActionUsers | null>(null);
    const [isLoadingActionUsers, setIsLoadingActionUsers] = useState<boolean>(false);
    const [actionUsersError, setActionUsersError] = useState<string | null>(null);

    const loadPaperAndActions = useCallback(async () => {
        if (!paperId) {
            setError("No paper ID provided.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setIsLoadingActionUsers(true); // Start loading actions too
        setError(null);
        setUpdateError(null);
        setIsRemoving(false);
        setIsUpdatingStatus(false);
        setIsVoting(false);
        setActionUsersError(null); // Reset action errors

        try {
            // Fetch paper details and action users in parallel
            const [fetchedPaper, fetchedActionUsers] = await Promise.all([
                fetchPaperByIdFromApi(paperId),
                fetchPaperActionUsers(paperId) // Fetch actions
            ]);

            if (fetchedPaper) {
                setPaper(fetchedPaper);
            } else {
                setError("Paper not found.");
                setPaper(null);
            }
            setActionUsers(fetchedActionUsers); // Set action users

        } catch (err) {
            console.error(`Failed to load data for paper ${paperId}:`, err);
            // Distinguish between paper load error and action user load error if needed
            if (err instanceof Error && err.message.includes('action users')) {
                setActionUsersError(err.message);
            } else {
                setError(err instanceof Error ? err.message : "Failed to load paper details or user actions. Is the backend running?");
            }
            setPaper(null); // Ensure paper is null on error
            setActionUsers(null); // Ensure actions are null on error
        } finally {
            setIsLoading(false);
            setIsLoadingActionUsers(false); // Finish loading actions
        }
    }, [paperId]);

    useEffect(() => {
        loadPaperAndActions();
    }, [loadPaperAndActions]);

    const handleUpvote = async (voteType: 'up' | 'none') => {
        if (!paper || !paperId || isVoting || !currentUser) return;
        setIsVoting(true);
        setUpdateError(null);
        try {
            const updatedPaper = await voteOnPaperInApi(paperId, voteType);
            setPaper(updatedPaper);
            // Refetch action users after upvote/downvote
            const updatedActionUsers = await fetchPaperActionUsers(paperId);
            setActionUsers(updatedActionUsers);
        } catch (err) {
            console.error(`Failed to ${voteType}vote paper ${paperId}:`, err);
            setUpdateError(err instanceof Error ? err.message : "Failed to update vote.");
        } finally {
            setIsVoting(false);
        }
    };

    const handleImplementabilityAction = async (
        action: 'vote_up' | 'vote_down' | 'retract' | 'owner_set_true' | 'owner_set_false'
    ) => {
        console.log(`handleImplementabilityAction called with action: ${action}, paperId: ${paperId}, isUpdatingStatus: ${isUpdatingStatus}`);

        if (!paper || !paperId || isUpdatingStatus) {
            console.log("handleImplementabilityAction: Guard clause prevented execution (paper, paperId, or isUpdatingStatus)");
            return;
        }
        const isAdmin = !!currentUser?.isAdmin;
        const isOwner = !!currentUser?.isOwner;
        const canPerformOwnerActions = isOwner || isAdmin;

        if (action === 'owner_set_true') {
            if (!window.confirm(`Are you sure you want to reset the status of "${paper.title}" to IMPLEMENTABLE? This will clear all community flags and votes.`)) {
                return;
            }
        } else if (action === 'owner_set_false') {
            if (!window.confirm(`Are you sure you want to force set the status of "${paper.title}" to NON-IMPLEMENTABLE? This will override community flags/votes.`)) {
                return;
            }
        }

        setUpdateError(null);
        setIsUpdatingStatus(true);
        console.log("handleImplementabilityAction: Set isUpdatingStatus to true");

        try {
            let updatedPaper: Paper;
            let apiAction: ImplementabilityAction | null = null;

            // Map frontend actions to backend API actions
            if (action === 'vote_up') {
                apiAction = 'confirm';
            } else if (action === 'vote_down') {
                apiAction = 'dispute';
            } else if (action === 'retract') {
                apiAction = 'retract';
            }
            console.log(`handleImplementabilityAction: Mapped frontend action '${action}' to API action '${apiAction}'`);

            if (apiAction) { // User voting actions
                 if (!currentUser) {
                     throw new Error("You must be logged in to vote.");
                 }
                 console.log(`handleImplementabilityAction: Calling flagImplementabilityInApi with paperId: ${paperId}, apiAction: ${apiAction}`);
                 updatedPaper = await flagImplementabilityInApi(paperId, apiAction);
            } else if (action === 'owner_set_true' && canPerformOwnerActions) { // Owner/Admin action
                console.log(`handleImplementabilityAction: Calling setImplementabilityInApi with paperId: ${paperId}, isImplementable: true`);
                updatedPaper = await setImplementabilityInApi(paperId, true);
            } else if (action === 'owner_set_false' && canPerformOwnerActions) { // Owner/Admin action
                console.log(`handleImplementabilityAction: Calling setImplementabilityInApi with paperId: ${paperId}, isImplementable: false`);
                updatedPaper = await setImplementabilityInApi(paperId, false);
            } else {
                 console.error(`handleImplementabilityAction: Invalid action ('${action}') or insufficient permissions (isOwner: ${isOwner}, isAdmin: ${isAdmin})`); // <-- Update log
                 throw new Error("Invalid action or insufficient permissions.");
            }
            setPaper(updatedPaper);
            // Refetch action users after status change
            const updatedActionUsers = await fetchPaperActionUsers(paperId);
            setActionUsers(updatedActionUsers);
            console.log(`Implementability action '${action}' (API: ${apiAction ?? action}) successful.`);

        } catch (err) {
            console.error(`Failed action '${action}' on implementability for paper ${paperId}:`, err);
            setUpdateError(err instanceof Error ? err.message : "Failed to update implementability status.");
        } finally {
            setIsUpdatingStatus(false);
            console.log("handleImplementabilityAction: Set isUpdatingStatus to false in finally block");
        }
    };

     const handleStepUpdate = (
        pId: string,
        stepId: number,
        newStatus: ImplementationStep['status']
    ) => {
        setUpdateError(null);
        if (!paper || paper.id !== pId) return;
        const stepIndex = paper.implementationSteps.findIndex(step => step.id === stepId);
        if (stepIndex === -1) return;
        const updatedStep = { ...paper.implementationSteps[stepIndex], status: newStatus };
        const newSteps = paper.implementationSteps.map(step => step.id === stepId ? updatedStep : step);
        setPaper({ ...paper, implementationSteps: newSteps });
        console.log(`Simulated LOCAL update for paper ${pId}, step ${stepId} to ${newStatus}`);
        // NOTE: You'll need to call updateStepStatusInApi here in a real implementation
        // updateStepStatusInApi(pId, stepId, newStatus).catch(err => ... handle error ...);
    };

     const handleRemovePaper = async () => {
        const isAdmin = !!currentUser?.isAdmin;
        const isOwner = !!currentUser?.isOwner;
        const canPerformOwnerActions = isOwner || isAdmin;
        if (!paper || !paperId || !canPerformOwnerActions || isRemoving) return;
        if (!window.confirm(`Are you sure you want to permanently remove the paper "${paper.title}"? This action cannot be undone.`)) return;
        setIsRemoving(true);
        setUpdateError(null);
        setError(null); // Clear main error too
        try {
            await removePaperFromApi(paperId);
            // Navigate back to the list page with a success message
            navigate('/', { replace: true, state: { message: 'Paper removed successfully.' } });
        } catch (err) {
            console.error(`Failed to remove paper ${paperId}:`, err);
            setUpdateError(err instanceof Error ? err.message : "Failed to remove paper. Please try again.");
            setIsRemoving(false); // Allow retry on error
        }
        // No finally block needed here as navigation occurs on success
    };


    // --- Loading / Error States ---
    if (isLoading && !paper) return <LoadingSpinner />;
    if (error && !isLoading) return <p className="error-message">Error: {error} <Link to="/">Go back to list</Link></p>;
    if (!paper && !isLoading) return <p>Paper data could not be loaded or was not found. <Link to="/">Go back to list</Link></p>;
    if (!paper) return null;

    // --- Derived variables ---
    const authors = paper.authors.map(a => a.name).join(', ');
    const canVote = !!currentUser;
    const isAdmin = !!currentUser?.isAdmin;
    const canPerformOwnerActions = !!currentUser?.isOwner || isAdmin;
    const userVote = paper.currentUserImplementabilityVote; // 'up', 'down', 'none'
    const userUpvoted = paper.currentUserVote === 'up';
    const status = paper.nonImplementableStatus;
    const confirmedBy = paper.nonImplementableConfirmedBy;

    // --- Implementability Notice ---
    let implementabilityNotice = null;
     if (status === 'confirmed_non_implementable') {
        implementabilityNotice = (
            <p className="not-implementable-notice confirmed">
                This paper has been confirmed as likely not suitable for implementation.
            </p>
        );
    } else if (status === 'flagged_non_implementable') {
        implementabilityNotice = (
            <div className="not-implementable-notice flagged">
                <p>This paper has been flagged as potentially non-implementable. Please review and vote in the 'Implementability Status' tab below.</p> {/* Updated text */}
            </div>
        );
    } else if (status === 'implementable' && confirmedBy === 'owner') {
        implementabilityNotice = (
            <p className="implementable-notice owner-confirmed">
                ✅ Status confirmed as implementable by owner.
            </p>
        );
    }


    // --- Determine if implementability voting is allowed ---
    const allowImplementabilityVoting = status === 'flagged_non_implementable' || (status === 'implementable' && confirmedBy !== 'owner');

    return (
        <div className="paper-detail-page">
            <div className="paper-content">
                <Link to="/" className="back-link">Back to List</Link>

                {updateError && <p className="error-message update-error">Error: {updateError}</p>}
                {isRemoving && <p className="loading-message">Removing paper...</p>}
                {(isUpdatingStatus || isVoting) && <p className="loading-message">Updating...</p>}

                <h1 className="paper-title">{paper.title}</h1>
                {implementabilityNotice && (
                    <div className="status-notice-container">
                        {implementabilityNotice}
                    </div>
                )}

                {/* --- Tab Navigation (Updated) --- */}
                <div className="paper-tabs">
                    <button
                        className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                        onClick={() => setActiveTab('details')}
                    >
                        Details
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'upvotes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('upvotes')}
                    >
                        Upvotes ({isLoadingActionUsers ? '...' : actionUsers?.upvotes?.length ?? 0})
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'implementability' ? 'active' : ''}`}
                        onClick={() => setActiveTab('implementability')}
                        title="View non-implementability status and votes"
                    >
                        Implementability Status
                        {/* Optionally show combined count or indicator if flagged */}
                        {(actionUsers?.confirmations?.length ?? 0) > 0 || (actionUsers?.disputes?.length ?? 0) > 0 ?
                         ` (${(actionUsers?.confirmations?.length ?? 0) + (actionUsers?.disputes?.length ?? 0)})` : ''}
                    </button>
                    {/* Removed separate Confirmations/Disputes buttons */}
                </div>

                {/* --- Tab Content --- */}
                <div className="tab-content">
                    {activeTab === 'details' && (
                        <>
                            {/* Meta, Abstract, Progress Tracker */}
                            <div className="paper-meta">
                                 <p><strong>Authors:</strong> {authors}</p>
                                <p><strong>Date:</strong> {paper.date}</p>
                                {paper.proceeding && <p><strong>Venue:</strong> {paper.proceeding}</p>}
                                {paper.arxivId && <p><strong>ArXiv ID:</strong> {paper.arxivId}</p>}
                                <p><strong>Links:</strong>{' '}
                                    {paper.urlAbs && <><a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">Abstract</a> | </>}
                                    {paper.urlPdf && <><a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">PDF</a> | </>}
                                    {paper.pwcUrl && <a href={paper.pwcUrl} target="_blank" rel="noopener noreferrer">PapersWithCode Page</a>}
                                </p>
                                {paper.tasks && paper.tasks.length > 0 && (<p><strong>Tasks:</strong> {paper.tasks.join(', ')}</p>)}
                            </div>
                            {paper.abstract && (<div className="paper-abstract"><h3>Abstract</h3><p>{paper.abstract}</p></div>)}
                            {status !== 'confirmed_non_implementable' ? (
                                <ProgressTracker
                                    steps={paper.implementationSteps}
                                    paperId={paper.id}
                                    onStepUpdate={handleStepUpdate}
                                />
                            ) : (
                                <p className="not-implementable-notice confirmed"> Progress Tracker is disabled for confirmed non-implementable papers. </p>
                            )}

                            {/* Privileged Actions */}
                            {canPerformOwnerActions && (
                                <div className="privileged-actions details-tab-section"> {/* Added class */}
                                    <h3>Owner/Admin Actions</h3>
                                     <div className="owner-implementability-actions">
                                        <button
                                            onClick={() => handleImplementabilityAction('owner_set_false')}
                                            disabled={isUpdatingStatus || status === 'confirmed_non_implementable'}
                                            className="button-warning"
                                        >
                                            Force Set Non-Implementable
                                        </button>
                                        <button
                                            onClick={() => handleImplementabilityAction('owner_set_true')}
                                            disabled={isUpdatingStatus || status === 'implementable'}
                                            className="button-secondary"
                                        >
                                            Reset to Implementable
                                        </button>
                                    </div>
                                    <div className="remove-paper-action">
                                        <button
                                            onClick={handleRemovePaper}
                                            disabled={isRemoving || isUpdatingStatus}
                                            className="button-danger remove-button"
                                        >
                                            {isRemoving ? 'Removing...' : 'Remove Paper Permanently'}
                                        </button>
                                        <p className="warning-text">
                                            Warning: Removing a paper moves it to a separate collection and removes it from public view. This action cannot be easily undone.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'upvotes' && (
                        // --- Upvotes Tab Content ---
                        <div className="tab-pane-container"> {/* Added container */}
                            {canVote ? (
                                <div className="tab-action-area">
                                    <button
                                        onClick={() => handleUpvote(userUpvoted ? 'none' : 'up')}
                                        disabled={isVoting}
                                        className={`vote-button upvote-tab ${userUpvoted ? 'voted' : ''}`}
                                        title={userUpvoted ? 'Remove upvote' : 'Upvote this paper'}
                                    >
                                        <FaArrowUp />
                                        <span>{userUpvoted ? 'Upvoted' : 'Upvote'}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="tab-action-area">
                                    <p><small>Login to upvote.</small></p>
                                </div>
                            )}
                            <UserDisplayList
                                users={actionUsers?.upvotes}
                                title="Upvoted By"
                                isLoading={isLoadingActionUsers}
                                error={actionUsersError}
                            />
                        </div>
                    )}

                    {activeTab === 'implementability' && (
                        // --- Implementability Status Tab Content ---
                        <div className="tab-pane-container"> {/* Added container */}
                            <div className="implementability-explanation">
                                <h4>Non-Implementability Voting</h4>
                                <p>
                                    Vote <FaThumbsUp /> <strong>Confirm Non-Implementable</strong> if you believe this paper is non-code-related, impractical, or impossible to implement (e.g., missing details, unclear methods).
                                    Vote <FaThumbsDown /> <strong>Dispute Non-Implementable</strong> if you believe the paper *is* implementable and should not be flagged.
                                    Votes are tallied to determine the paper's status.
                                </p>
                            </div>

                            {/* Voting Buttons Area */}
                            <div className="tab-action-area">
                                {allowImplementabilityVoting && canVote && (
                                    <>
                                        <button
                                            onClick={() => handleImplementabilityAction('vote_up')}
                                            disabled={isUpdatingStatus || userVote === 'up'}
                                            className={`vote-button thumbs-up ${userVote === 'up' ? 'voted' : ''}`}
                                            title={status === 'implementable' ? 'Flag as non-implementable' : 'Confirm non-implementable'}
                                        >
                                            <FaThumbsUp />
                                            <span>{userVote === 'up' ? 'Confirmed' : 'Confirm'}</span>
                                        </button>
                                        <button
                                            onClick={() => handleImplementabilityAction('vote_down')}
                                            disabled={isUpdatingStatus || userVote === 'down' || status === 'implementable'} // Can't dispute if already implementable
                                            className={`vote-button thumbs-down ${userVote === 'down' ? 'voted' : ''}`}
                                            title={status === 'implementable' ? 'Cannot dispute (already implementable)' : "Dispute non-implementability (vote as implementable)"}
                                        >
                                            <FaThumbsDown />
                                            <span>{userVote === 'down' ? 'Disputed' : 'Dispute'}</span>
                                        </button>
                                        {userVote !== 'none' && ( // Show retract only if user voted this way
                                            <button
                                                onClick={() => handleImplementabilityAction('retract')}
                                                disabled={isUpdatingStatus}
                                                className="button-link retract-vote-button"
                                            >
                                                Retract Vote
                                            </button>
                                        )}
                                    </>
                                )}
                                {!allowImplementabilityVoting && <p><small>Voting closed (status confirmed by owner or community threshold met).</small></p>}
                                {!canVote && <p><small>Login to vote.</small></p>}
                            </div>

                            {/* Two-Column Layout for Lists */}
                            <div className="implementability-lists-container">
                                <div className="implementability-list-column">
                                    <UserDisplayList
                                        users={actionUsers?.confirmations}
                                        title="Confirmed Non-Implementable"
                                        isLoading={isLoadingActionUsers}
                                        error={actionUsersError}
                                    />
                                </div>
                                <div className="implementability-list-column">
                                    <UserDisplayList
                                        users={actionUsers?.disputes}
                                        title="Disputed Non-Implementable"
                                        isLoading={isLoadingActionUsers}
                                        error={actionUsersError}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Removed separate Confirmations/Disputes tab content */}
                </div>

            </div>
        </div>
    );
};

export default PaperDetailPage;