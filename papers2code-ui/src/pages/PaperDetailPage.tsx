import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    fetchPaperByIdFromApi,
    removePaperFromApi,
    flagImplementabilityInApi,
    setImplementabilityInApi,
    ImplementabilityAction // Keep this type, maps to backend actions
} from '../services/api';
import { Paper, ImplementationStep, ImplementationStatus } from '../types/paper'; // Import ImplementationStatus enum
import { UserProfile } from '../services/auth';
import LoadingSpinner from '../components/LoadingSpinner';
import ProgressTracker from '../components/PaperDetailComponents/ProgressTracker';
// --- NEW: Import Thumb Icons (assuming you have them, e.g., from react-icons) ---
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa'; // Example using react-icons
import './PaperDetailPage.css';

interface PaperDetailPageProps {
    currentUser: UserProfile | null;
}

const PaperDetailPage: React.FC<PaperDetailPageProps> = ({ currentUser }) => {
    const { paperId } = useParams<{ paperId: string }>();
    const navigate = useNavigate();
    const [paper, setPaper] = useState<Paper | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState<boolean>(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

    const loadPaper = useCallback(async () => {
        // ... (existing loadPaper logic - no changes needed here) ...
        if (!paperId) {
            setError("No paper ID provided.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        setUpdateError(null);
        setIsRemoving(false);
        setIsUpdatingStatus(false);
        try {
            const fetchedPaper = await fetchPaperByIdFromApi(paperId);
            if (fetchedPaper) {
                setPaper(fetchedPaper);
            } else {
                setError("Paper not found.");
                setPaper(null);
            }
        } catch (err) {
            console.error(`Failed to fetch paper ${paperId}:`, err);
            setError(err instanceof Error ? err.message : "Failed to load paper details. Is the backend running?");
            setPaper(null);
        } finally {
            setIsLoading(false);
        }
    }, [paperId]);

    useEffect(() => {
        loadPaper();
    }, [loadPaper]);

    const handleStepUpdate = (
        pId: string,
        stepId: number,
        newStatus: ImplementationStep['status']
    ) => {
        // ... (keep existing simulated logic) ...
        setUpdateError(null);
        if (!paper || paper.id !== pId) return;
        const stepIndex = paper.implementationSteps.findIndex(step => step.id === stepId);
        if (stepIndex === -1) return;
        const updatedStep = { ...paper.implementationSteps[stepIndex], status: newStatus };
        const newSteps = paper.implementationSteps.map(step => step.id === stepId ? updatedStep : step);
        setPaper({ ...paper, implementationSteps: newSteps });
        console.log(`Simulated LOCAL update for paper ${pId}, step ${stepId} to ${newStatus}`);
    };

    // --- UPDATED: Handle Implementability Actions (Voting, Owner Set) ---
    const handleImplementabilityAction = async (
        action: 'vote_up' | 'vote_down' | 'retract' | 'owner_set_true' | 'owner_set_false'
    ) => {
        console.log(`handleImplementabilityAction called with action: ${action}, paperId: ${paperId}, isUpdatingStatus: ${isUpdatingStatus}`);

        if (!paper || !paperId || isUpdatingStatus) {
            console.log("handleImplementabilityAction: Guard clause prevented execution (paper, paperId, or isUpdatingStatus)");
            return;
        }

        // --- Add Confirmation for Owner Actions ---
        if (action === 'owner_set_true') {
            if (!window.confirm(`Are you sure you want to reset the status of "${paper.title}" to IMPLEMENTABLE? This will clear all community flags and votes.`)) {
                return; // Abort if user cancels
            }
        } else if (action === 'owner_set_false') {
             if (!window.confirm(`Are you sure you want to force set the status of "${paper.title}" to NON-IMPLEMENTABLE? This will override community flags/votes.`)) {
                return; // Abort if user cancels
            }
        }
        // --- End Confirmation ---

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
            } else if (action === 'owner_set_true' && currentUser?.isOwner) { // Owner actions
                console.log(`handleImplementabilityAction: Calling setImplementabilityInApi with paperId: ${paperId}, isImplementable: true`);
                updatedPaper = await setImplementabilityInApi(paperId, true);
            } else if (action === 'owner_set_false' && currentUser?.isOwner) {
                console.log(`handleImplementabilityAction: Calling setImplementabilityInApi with paperId: ${paperId}, isImplementable: false`);
                updatedPaper = await setImplementabilityInApi(paperId, false);
            } else {
                 console.error(`handleImplementabilityAction: Invalid action ('${action}') or insufficient permissions (isOwner: ${currentUser?.isOwner})`);
                 throw new Error("Invalid action or insufficient permissions.");
            }
            setPaper(updatedPaper);
            console.log(`Implementability action '${action}' (API: ${apiAction ?? action}) successful.`);
        } catch (err) {
            console.error(`Failed action '${action}' on implementability for paper ${paperId}:`, err);
            setUpdateError(err instanceof Error ? err.message : "Failed to update implementability status.");
        } finally {
            setIsUpdatingStatus(false);
            console.log("handleImplementabilityAction: Set isUpdatingStatus to false in finally block");
        }
    };

    const handleRemovePaper = async () => {
        // ... (keep existing logic) ...
        if (!paper || !paperId || !currentUser?.isOwner || isRemoving) return;
        if (!window.confirm(`Are you sure you want to permanently remove the paper "${paper.title}"? This action cannot be undone.`)) return;
        setIsRemoving(true);
        setUpdateError(null);
        setError(null);
        try {
            await removePaperFromApi(paperId);
            navigate('/', { replace: true, state: { message: 'Paper removed successfully.' } });
        } catch (err) {
            console.error(`Failed to remove paper ${paperId}:`, err);
            setUpdateError(err instanceof Error ? err.message : "Failed to remove paper. Please try again.");
            setIsRemoving(false);
        }
    };

    // --- Render Logic ---
    if (isLoading && !paper) return <LoadingSpinner />;
    if (error && !isLoading) return <p className="error-message">Error: {error} <Link to="/">Go back to list</Link></p>;
    if (!paper && !isLoading) return <p>Paper data could not be loaded or was not found. <Link to="/">Go back to list</Link></p>;
    if (!paper) return <LoadingSpinner />; // Fallback

    const authors = paper.authors.map(a => a.name).join(', ');
    const canVote = !!currentUser;
    const isOwner = !!currentUser?.isOwner;

    const userVote = paper.currentUserImplementabilityVote; // 'up', 'down', 'none'
    const status = paper.nonImplementableStatus;
    const confirmedBy = paper.nonImplementableConfirmedBy; // Needed for owner confirmation check

    // --- UPDATED: Implementability Notice Logic ---
    let implementabilityNotice = null;
    if (status === 'confirmed_non_implementable') {
        // Notice for confirmed NON-implementable
        implementabilityNotice = (
            <p className="not-implementable-notice confirmed">
                This paper has been confirmed as likely not suitable for implementation.
                {/* REMOVED: Overall Status line */}
            </p>
        );
    } else if (status === 'flagged_non_implementable') {
        // Notice for flagged non-implementable (prompting for votes)
        implementabilityNotice = (
            <div className="not-implementable-notice flagged">
                <p>This paper has been flagged as potentially non-implementable. Please vote:</p>
                {/* REMOVED: Overall Status line */}
            </div>
        );
    } else if (status === 'implementable' && confirmedBy === 'owner') {
        // --- NEW: Notice for owner-confirmed IMPLEMENTABLE ---
        implementabilityNotice = (
            <p className="implementable-notice owner-confirmed">
                ✅ Status confirmed as implementable by owner.
                {/* REMOVED: Overall Status line */}
            </p>
        );
    } else {
         // Default notice for implementable (not explicitly confirmed by owner)
         // No specific notice needed here unless desired. Can be null or a generic message.
         // implementabilityNotice = <p className="implementable-notice">Status: Implementable</p>; // Example if needed
         implementabilityNotice = null; // Keep it clean by default
    }


    return (
        <div className="paper-detail-page">
            <div className="paper-content">
                <Link to="/" className="back-link">Back to List</Link>

                {updateError && <p className="error-message update-error">Error: {updateError}</p>}
                {isRemoving && <p className="loading-message">Removing paper...</p>}
                {isUpdatingStatus && <p className="loading-message">Updating status...</p>}

                <h1 className="paper-title">{paper.title}</h1>
                {/* Display Implementability Status Notice */}
                {implementabilityNotice && ( // Only render div if notice exists
                    <div className="status-notice-container">
                        {implementabilityNotice}
                    </div>
                )}

                <div className="paper-meta">
                    {/* ... existing meta details ... */}
                     <p><strong>Authors:</strong> {authors}</p>
                     <p><strong>Date:</strong> {paper.date}</p>
                     {paper.proceeding && <p><strong>Venue:</strong> {paper.proceeding}</p>}
                     {paper.arxivId && <p><strong>ArXiv ID:</strong> {paper.arxivId}</p>}
                     <p><strong>Links:</strong>{' '}
                         {paper.urlAbs && <><a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">Abstract</a> |</>}
                         {paper.urlPdf && <><a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">PDF</a> |</>}
                         {paper.pwcUrl && <a href={paper.pwcUrl} target="_blank" rel="noopener noreferrer">PapersWithCode Page</a>}
                     </p>
                     {paper.tasks && paper.tasks.length > 0 && (<p><strong>Tasks:</strong> {paper.tasks.join(', ')}</p>)}
                </div>
                {paper.abstract && (<div className="paper-abstract"><h3>Abstract</h3><p>{paper.abstract}</p></div>)}

                {/* --- Progress Tracker (Show based on *confirmed* status) --- */}
                {/* Show tracker only if NOT confirmed non-implementable */}
                {status !== 'confirmed_non_implementable' ? (
                    <ProgressTracker
                        steps={paper.implementationSteps}
                        paperId={paper.id}
                        onStepUpdate={handleStepUpdate}
                    />
                ) : (
                    <p className="not-implementable-notice confirmed"> Progress Tracker is disabled for confirmed non-implementable papers. </p>
                )}

                 {/* --- Implementability Actions --- */}
                 <div className="paper-actions"> {/* Outer container */}
                    {/* --- FIX: Show voting if implementable OR flagged --- */}
                    {(status === 'flagged_non_implementable' || (status === 'implementable' && confirmedBy !== 'owner'))  && (
                        <div className="implementability-actions"> {/* Inner container for voting/flagging */}
                            <h4>{status === 'implementable' ? 'Flag Non-Implementable?' : 'Non-Implementability Voting'}</h4>
                            <p className="voting-description">
                                {status === 'implementable'
                                    ? 'Vote here if you believe this paper is non-code-related, impractical, or impossible to implement due to missing details, unclear methods, or other factors.'
                                    : 'This paper has been flagged. Confirm or dispute the non-implementable status.'}
                            </p>

                            {/* Voting UI */}
                            <div className="user-implementability-actions">
                                {canVote ? (
                                    <>
                                        {/* Thumbs Up Button (Flag or Confirm Non-Implementable) */}
                                        <button
                                            onClick={() => handleImplementabilityAction('vote_up')}
                                            disabled={isUpdatingStatus || userVote === 'up'}
                                            className={`vote-button thumbs-up ${userVote === 'up' ? 'voted' : ''}`}
                                            // --- FIX: Adjust title based on status --- 
                                            title={status === 'implementable' ? 'Flag as non-implementable' : 'Confirm non-implementable'}
                                        >
                                            <FaThumbsUp />
                                            <span className="vote-count">{paper.nonImplementableVotes}</span>
                                        </button>

                                        {/* Thumbs Down Button (Dispute Non-Implementable) */}
                                        {/* Only show dispute button if status is flagged, or if implementable AND user has voted up (to allow changing vote) */}
                                        {(status === 'flagged_non_implementable' || (status === 'implementable' && userVote === 'up')) && (
                                            <button
                                                onClick={() => handleImplementabilityAction('vote_down')}
                                                disabled={isUpdatingStatus || userVote === 'down'}
                                                className={`vote-button thumbs-down ${userVote === 'down' ? 'voted' : ''}`}
                                                title="Dispute non-implementability (vote as implementable)"
                                            >
                                                <FaThumbsDown />
                                                <span className="vote-count">{paper.disputeImplementableVotes}</span>
                                            </button>
                                        )}

                                        {/* Retract Vote Button */}
                                        {userVote !== 'none' && ( // Show retract if user has voted (up or down)
                                            <button
                                                onClick={() => handleImplementabilityAction('retract')}
                                                disabled={isUpdatingStatus}
                                                className="button-link retract-vote-button"
                                            >
                                                Retract Vote
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <p><small>Login to vote on implementability status.</small></p>
                                )}
                            </div>
                        </div>
                    )}

                    {isOwner && (
                        <div className="owner-actions">
                            <h3>Owner Actions</h3>
                            {/* Owner Implementability Override */}
                            <div className="owner-implementability-actions">
                                <button
                                    onClick={() => handleImplementabilityAction('owner_set_false')}
                                    disabled={isUpdatingStatus || status === 'confirmed_non_implementable'}
                                    className="button-warning" // Use warning for setting non-implementable
                                >
                                    Force Set Non-Implementable
                                </button>
                                <button
                                    onClick={() => handleImplementabilityAction('owner_set_true')}
                                    // Disable if already implementable (regardless of who confirmed)
                                    disabled={isUpdatingStatus || status === 'implementable'}
                                    className="button-secondary"
                                >
                                    Reset to Implementable
                                </button>
                            </div>
                            {/* Remove Paper */}
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
                </div> {/* End paper-actions outer container */}
            </div>
        </div>
    );
};

export default PaperDetailPage;