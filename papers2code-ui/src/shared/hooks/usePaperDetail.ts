import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, ImplementabilityAction } from '../types/paper';
import type { ImplementationProgress, ProgressUpdateRequest } from '../types/implementation';
import type { UserProfile } from '../types/user';
import {
    fetchPaperByIdFromApi,
    flagImplementabilityInApi,
    setImplementabilityInApi,
    removePaperFromApi,
    voteOnPaperInApi,
    fetchPaperActionUsers,
    PaperActionUsers,
    AuthenticationError,
    CsrfError,
    joinOrCreateImplementationProgress,
    updateImplementationProgressInApi // Placeholder for the new API function
} from '../services/api';

import { useModal } from '../context/ModalContext';

export type ActiveTab = 'paperInfo' | 'details' | 'upvotes' | 'implementability' | 'admin' | 'implementationProgress';

// Define the type for the status that can be set by an admin/owner.
// These are the values that will be displayed in the UI and passed to handleSetImplementabilityStatus.
export type AdminSettableImplementabilityStatus = 'Admin Not Implementable' | 'Admin Implementable' | 'Voting';

export function usePaperDetail(paperId: string | undefined, currentUser: UserProfile | null) {
    const navigate = useNavigate();
    const [paper, setPaper] = useState<Paper | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState<boolean>(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false); // For owner actions
    const [isVoting, setIsVoting] = useState<boolean>(false); // For general upvotes/implementability votes
    const [isUpdatingProgress, setIsUpdatingProgress] = useState<boolean>(false); // New state for progress updates
    const [progressUpdateError, setProgressUpdateError] = useState<string | null>(null); // New error state for progress updates

    const [activeTab, setActiveTab] = useState<ActiveTab>('paperInfo');
    const [actionUsers, setActionUsers] = useState<PaperActionUsers | null>(null);
    const [isLoadingActionUsers, setIsLoadingActionUsers] = useState<boolean>(false);
    const [actionUsersError, setActionUsersError] = useState<string | null>(null);

    const [showConfirmRemoveModal, setShowConfirmRemoveModal] = useState<boolean>(false);
    const [showConfirmStatusModal, setShowConfirmStatusModal] = useState<{ show: boolean; status: AdminSettableImplementabilityStatus | null }>({ show: false, status: null });

    // --- NEW: State for implementation effort actions ---
    const [isProcessingEffortAction, setIsProcessingEffortAction] = useState<boolean>(false);
    const [effortActionError, setEffortActionError] = useState<string | null>(null);
    // --- End NEW ---

    const { showLoginPrompt } = useModal();

    const loadPaperAndActions = useCallback(async () => {
        if (!paperId) {
            setError("No paper ID provided.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setIsLoadingActionUsers(true);
        setError(null);
        setUpdateError(null);
        setIsRemoving(false);
        setIsUpdatingStatus(false);
        setIsVoting(false);
        setActionUsersError(null);
        setProgressUpdateError(null); // Reset progress update error

        try {
            const [fetchedPaper, fetchedActionUsers] = await Promise.all([
                fetchPaperByIdFromApi(paperId),
                fetchPaperActionUsers(paperId)
            ]);

            if (fetchedPaper) {
                setPaper(fetchedPaper);
            } else {
                setError("Paper not found.");
                setPaper(null);
            }
            setActionUsers(fetchedActionUsers);

        } catch (err) {
            console.error(`Failed to load data for paper ${paperId}:`, err);
            if (err instanceof Error && err.message.includes('action users')) {
                setActionUsersError(err.message);
            } else {
                setError(err instanceof Error ? err.message : "Failed to load paper details or user actions. Is the backend running?");
            }
            setPaper(null);
            setActionUsers(null);
        } finally {
            setIsLoading(false);
            setIsLoadingActionUsers(false);
        }
    }, [paperId]);

    useEffect(() => {
        loadPaperAndActions();
    }, [loadPaperAndActions]);

    // --- Action Handlers ---

    // --- NEW: Handler for initiating or joining implementation effort ---
    const handleInitiateJoinImplementationEffort = useCallback(async () => {
        if (!paperId || isProcessingEffortAction) return;
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to start or join an implementation effort.");
            return;
        }

        setIsProcessingEffortAction(true);
        setEffortActionError(null);
        setUpdateError(null); // Clear general update errors as well

        try {
            const updatedPaper = await joinOrCreateImplementationProgress(paperId);
            setPaper(updatedPaper); // Update the local paper state with the response
            // Optionally, refetch action users if joining/starting an effort might affect that data
            // fetchPaperActionUsers(paperId).then(setActionUsers).catch(err => setActionUsersError(err.message));
            console.log("Successfully initiated/joined implementation effort.");
        } catch (err) {
            console.error("Failed to initiate/join implementation effort:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to start or join the effort.";
            if (err instanceof AuthenticationError || err instanceof CsrfError) {
                showLoginPrompt("Please connect with GitHub to perform this action.");
                setEffortActionError(errorMessage); 
            } else {
                setEffortActionError(`API Error: ${errorMessage}`);
            }
            // Also set the general updateError if it's a more generic way to display errors on the page
            setUpdateError(errorMessage);
        } finally {
            setIsProcessingEffortAction(false);
        }    }, [paperId, currentUser, isProcessingEffortAction, showLoginPrompt, setPaper, /* setActionUsers, setActionUsersError */]);
    // --- End NEW ---

    // --- NEW: Handler for updating implementation progress ---
    const updateImplementationProgress = useCallback(async (updatedProgressData: ImplementationProgress) => {
        if (!paperId || !paper || !paper.implementationProgress) return; // Ensure paper and progress exist
        if (isUpdatingProgress) return;

        setIsUpdatingProgress(true);
        setProgressUpdateError(null);
        setUpdateError(null); // Clear general update error

        try {
            // Extract the fields that can be updated
            const progressUpdate: ProgressUpdateRequest = {
                status: updatedProgressData.status,
                githubRepoId: updatedProgressData.githubRepoId || undefined,
            };
            console.log('updateImplementationProgress: progress data:', updatedProgressData);
            console.log('updateImplementationProgress: using paperId:', paperId);
            console.log('updateImplementationProgress: progressUpdate:', progressUpdate);
            
            const updatedProgress = await updateImplementationProgressInApi(
                paperId, // Use paperId instead of progressId
                progressUpdate
            );
            
            // Update local paper state with the new progress data
            setPaper(prevPaper => {
                if (!prevPaper) return prevPaper;
                return {
                    ...prevPaper,
                    implementationProgress: updatedProgress
                };
            });
            // Optionally, inform the user of success via a toast or similar
        } catch (err) {
            console.error("Failed to update implementation progress:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to update implementation progress.";
            if (err instanceof AuthenticationError || err instanceof CsrfError) {
                showLoginPrompt("Please connect with GitHub to update progress.");
                setProgressUpdateError(errorMessage);
            } else {
                setProgressUpdateError(`API Error: ${errorMessage}`);
            }
            setUpdateError(errorMessage); // Also set general update error for broader display if needed
        }
        finally {
            setIsUpdatingProgress(false);
        }
    }, [paperId, paper, isUpdatingProgress, showLoginPrompt, setPaper, setIsUpdatingProgress, setProgressUpdateError, setUpdateError]);
    // --- End NEW ---

    const handleUpvote = useCallback(async (voteType: 'up' | 'none') => {
        if (!paperId || isVoting) return;
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to upvote.");
            return;
        }
        setIsVoting(true);
        setUpdateError(null);
        try {
            const updatedPaper = await voteOnPaperInApi(paperId, voteType);
            setPaper(updatedPaper);
            fetchPaperActionUsers(paperId).then(setActionUsers).catch(err => setActionUsersError(err.message));
        } catch (err) {
            console.error("Failed to upvote:", err);
            if (err instanceof AuthenticationError || err instanceof CsrfError) {
                showLoginPrompt("Please connect with GitHub to upvote.");
                setUpdateError(err.message); // Optionally set updateError as well
            } else {
                setUpdateError(err instanceof Error ? err.message : "Failed to update vote.");
            }
        } finally {
            setIsVoting(false);
        }
    }, [paperId, currentUser, isVoting, setPaper, setUpdateError, setActionUsers, setActionUsersError, setIsVoting, showLoginPrompt]);

    const handleImplementabilityVote = useCallback(async (action: ImplementabilityAction) => {
        if (!paperId || isVoting) return;
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to vote on implementability.");
            return;
        }
        setIsVoting(true);
        setUpdateError(null);
        try {
            const updatedPaper = await flagImplementabilityInApi(paperId, action);
            setPaper(updatedPaper);
            fetchPaperActionUsers(paperId).then(setActionUsers).catch(err => setActionUsersError(err.message));
        } catch (err) {
            console.error("Failed to vote on implementability:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to update implementability vote.";
            if (err instanceof AuthenticationError || err instanceof CsrfError) {
                showLoginPrompt("Please connect with GitHub to vote on implementability.");
                setUpdateError(errorMessage);
            } else {
                setUpdateError(`API Error: ${errorMessage}`);
            }
        } finally {
            setIsVoting(false);
        }
    }, [paperId, currentUser, isVoting, setPaper, setUpdateError, setActionUsers, setActionUsersError, setIsVoting, showLoginPrompt]);

    const handleSetImplementabilityStatus = useCallback(async (status: AdminSettableImplementabilityStatus) => {
        if (!paperId || isUpdatingStatus) return;
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to set implementability status.");
            return;
        }
        setIsUpdatingStatus(true);
        setUpdateError(null);
        setShowConfirmStatusModal({ show: false, status: null }); // Close modal
        try {
            // This will now cause a type error, which we will fix in api.ts next
            const updatedPaper = await setImplementabilityInApi(paperId, status);
            setPaper(updatedPaper);
        } catch (err) {
            console.error(`Failed to set implementability status to ${status}:`, err);
            if (err instanceof AuthenticationError || err instanceof CsrfError) {
                showLoginPrompt("Please connect with GitHub to set implementability status.");
                setUpdateError(err.message);
            } else {
                setUpdateError(err instanceof Error ? err.message : `Failed to set status to ${status}.`);
            }
        } finally {
            setIsUpdatingStatus(false);
        }
    }, [paperId, currentUser, isUpdatingStatus, setPaper, setUpdateError, showLoginPrompt]);

    const handleRemovePaper = useCallback(async () => {
        if (!paperId || isRemoving) return;
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to remove this paper.");
            return;
        }
        setIsRemoving(true);
        setUpdateError(null);
        setShowConfirmRemoveModal(false); // Close modal first
        try {
            await removePaperFromApi(paperId);
            navigate('/'); // Navigate to home or paper list page
        } catch (err) {
            console.error("Failed to remove paper:", err);
            if (err instanceof AuthenticationError || err instanceof CsrfError) {
                showLoginPrompt("Please connect with GitHub to remove this paper.");
                setUpdateError(err.message);
            } else {
                setUpdateError(err instanceof Error ? err.message : "Failed to remove paper.");
            }
            setIsRemoving(false); // Only set back if removal failed
        } 
    }, [paperId, currentUser, isRemoving, navigate, setUpdateError, setIsRemoving, setShowConfirmRemoveModal, showLoginPrompt]);

    // --- Modal Openers ---
    // Open modal with the specific owner DB status to confirm
    const openConfirmStatusModal = (status: AdminSettableImplementabilityStatus) => {
        setShowConfirmStatusModal({ show: true, status });
    };

    // --- Return Values ---
    return {
        paper,
        isLoading,
        error,
        updateError,
        isRemoving,
        isUpdatingStatus,
        isVoting,
        activeTab,
        actionUsers,
        isLoadingActionUsers,
        actionUsersError,
        showConfirmRemoveModal,
        showConfirmStatusModal,
        isProcessingEffortAction, // Return new state
        effortActionError,      // Return new error state
        isUpdatingProgress, // Return new state for progress updates
        progressUpdateError, // Return new error state for progress updates
        loadPaperAndActions, // Renamed from reloadPaper for clarity
        handleUpvote,
        handleImplementabilityVote,
        handleSetImplementabilityStatus,
        handleRemovePaper,
        setActiveTab,
        setShowConfirmRemoveModal,
        setShowConfirmStatusModal,
        openConfirmStatusModal, // Added this to the return object
        handleInitiateJoinImplementationEffort, // Return new handler
        updateImplementationProgress // Return new handler for progress updates
    };
}