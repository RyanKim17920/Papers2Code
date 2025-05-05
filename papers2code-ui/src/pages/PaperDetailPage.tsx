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
        // Action type now includes 'vote_up', 'vote_down' for clarity
        action: 'vote_up' | 'vote_down' | 'retract' | 'owner_set_true' | 'owner_set_false'
    ) => {
        if (!paper || !paperId || isUpdatingStatus) return;

        setUpdateError(null);
        setIsUpdatingStatus(true);

        try {
            let updatedPaper: Paper;
            let apiAction: ImplementabilityAction | null = null;

            // Map frontend actions to backend API actions
            if (action === 'vote_up') {
                // If paper is 'implementable', first vote is a 'flag' action
                apiAction = paper.nonImplementableStatus === 'implementable' ? 'flag' : 'confirm';
            } else if (action === 'vote_down') {
                apiAction = 'dispute';
            } else if (action === 'retract') {
                apiAction = 'retract';
            }

            if (apiAction) { // User voting actions
                 if (!currentUser) {
                     throw new Error("You must be logged in to vote.");
                 }
                 updatedPaper = await flagImplementabilityInApi(paperId, apiAction);
            } else if (action === 'owner_set_true' && currentUser?.isOwner) { // Owner actions
                updatedPaper = await setImplementabilityInApi(paperId, true);
            } else if (action === 'owner_set_false' && currentUser?.isOwner) {
                updatedPaper = await setImplementabilityInApi(paperId, false);
            } else {
                 throw new Error("Invalid action or insufficient permissions.");
            }
            setPaper(updatedPaper);
            console.log(`Implementability action '${action}' (API: ${apiAction ?? action}) successful.`);
        } catch (err) {
            console.error(`Failed action '${action}' on implementability for paper ${paperId}:`, err);
            setUpdateError(err instanceof Error ? err.message : "Failed to update implementability status.");
        } finally {
            setIsUpdatingStatus(false);
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
                    {/* --- UPDATED CONDITION: Only show voting if status is 'flagged' --- */}
                    {status === 'flagged_non_implementable' && (
                        <div className="implementability-actions"> {/* Inner container for voting/flagging */}
                            <h4>Non-Implementability Voting</h4>
                            <p className="voting-description">
                                Vote here if you believe this paper is non-code-related, impractical, or impossible to implement due to missing details, unclear methods, or other factors.
                            </p>

                            {/* Voting UI */}
                            <div className="user-implementability-actions">
                                {canVote ? (
                                    <>
                                        {/* Thumbs Up Button (Confirm Non-Implementable) */}
                                        <button
                                            onClick={() => handleImplementabilityAction('vote_up')}
                                            disabled={isUpdatingStatus || userVote === 'up'}
                                            className={`vote-button thumbs-up ${userVote === 'up' ? 'voted' : ''}`}
                                            title="Confirm non-implementable" // Title simplified as it only shows when flagged
                                        >
                                            <FaThumbsUp />
                                            <span className="vote-count">{paper.nonImplementableVotes}</span>
                                        </button>

                                        {/* Thumbs Down Button (Dispute Non-Implementable) */}
                                        <button
                                            onClick={() => handleImplementabilityAction('vote_down')}
                                            disabled={isUpdatingStatus || userVote === 'down'}
                                            className={`vote-button thumbs-down ${userVote === 'down' ? 'voted' : ''}`}
                                            title="Dispute non-implementability (vote as implementable)"
                                        >
                                            <FaThumbsDown />
                                            <span className="vote-count">{paper.disputeImplementableVotes}</span>
                                        </button>

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
                                    disabled={isUpdatingStatus || status === 'implementable'}
                                    className="button-secondary" // Use secondary/neutral for setting implementable
                                >
                                    Force Set Implementable
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