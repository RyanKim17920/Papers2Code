import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper } from '../types/paper'; // Removed ImplementationStep if not used directly here
import { UserProfile } from '../services/auth';
import {
    fetchPaperByIdFromApi,
    flagImplementabilityInApi,
    setImplementabilityInApi,
    removePaperFromApi,
    voteOnPaperInApi,
    fetchPaperActionUsers,
    PaperActionUsers
} from '../services/api';
import { ImplementabilityAction, OwnerSettableImplementabilityStatus } from '../types/paper'; // Import status type

export type ActiveTab = 'paperInfo' | 'details' | 'upvotes' | 'implementability' | 'admin';

export function usePaperDetail(paperId: string | undefined, currentUser: UserProfile | null) {
    const navigate = useNavigate();
    const [paper, setPaper] = useState<Paper | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState<boolean>(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false); // For owner actions
    const [isVoting, setIsVoting] = useState<boolean>(false); // For general upvotes/implementability votes

    const [activeTab, setActiveTab] = useState<ActiveTab>('paperInfo');
    const [actionUsers, setActionUsers] = useState<PaperActionUsers | null>(null);
    const [isLoadingActionUsers, setIsLoadingActionUsers] = useState<boolean>(false);
    const [actionUsersError, setActionUsersError] = useState<string | null>(null);

    const [showConfirmRemoveModal, setShowConfirmRemoveModal] = useState<boolean>(false);
    // Modal state for owner status actions: DB statuses confirmed_non_implementable or confirmed_implementable
    const [showConfirmStatusModal, setShowConfirmStatusModal] = useState<{ show: boolean; status: OwnerSettableImplementabilityStatus | null }>({ show: false, status: null });

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

    const handleUpvote = useCallback(async (voteType: 'up' | 'none') => {
        if (!paperId || !currentUser || isVoting) return;
        setIsVoting(true);
        setUpdateError(null);
        try {
            const updatedPaper = await voteOnPaperInApi(paperId, voteType);
            setPaper(updatedPaper);
            fetchPaperActionUsers(paperId).then(setActionUsers).catch(err => setActionUsersError(err.message));
        } catch (err) {
            console.error("Failed to upvote:", err);
            setUpdateError(err instanceof Error ? err.message : "Failed to update vote.");
        } finally {
            setIsVoting(false);
        }
    }, [paperId, currentUser, isVoting, setPaper, setUpdateError, setActionUsers, setActionUsersError, setIsVoting]);

    const handleImplementabilityVote = useCallback(async (action: ImplementabilityAction) => {
        if (!paperId || !currentUser || isVoting) return;
        setIsVoting(true);
        setUpdateError(null);
        try {
            const updatedPaper = await flagImplementabilityInApi(paperId, action);
            setPaper(updatedPaper);
            fetchPaperActionUsers(paperId).then(setActionUsers).catch(err => setActionUsersError(err.message));
        } catch (err) {
            console.error("Failed to vote on implementability:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to update implementability vote.";
            setUpdateError(`API Error: ${errorMessage}`);
        } finally {
            setIsVoting(false);
        }
    }, [paperId, currentUser, isVoting, setPaper, setUpdateError, setActionUsers, setActionUsersError, setIsVoting]);

    const handleSetImplementabilityStatus = useCallback(async (status: OwnerSettableImplementabilityStatus) => {
        if (!paperId || !currentUser || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        setUpdateError(null);
        setShowConfirmStatusModal({ show: false, status: null }); // Close modal
        try {
            const updatedPaper = await setImplementabilityInApi(paperId, status);
            setPaper(updatedPaper);
        } catch (err) {
            console.error(`Failed to set implementability status to ${status}:`, err);
            setUpdateError(err instanceof Error ? err.message : `Failed to set status to ${status}.`);
        } finally {
            setIsUpdatingStatus(false);
        }
    }, [paperId, currentUser, isUpdatingStatus, setPaper, setUpdateError]);

    const handleRemovePaper = useCallback(async () => {
        if (!paperId || !currentUser || isRemoving) return;
        setIsRemoving(true);
        setUpdateError(null);
        setShowConfirmRemoveModal(false); // Close modal first
        try {
            await removePaperFromApi(paperId);
            navigate('/'); // Navigate to home or paper list page
        } catch (err) {
            console.error("Failed to remove paper:", err);
            setUpdateError(err instanceof Error ? err.message : "Failed to remove paper.");
            setIsRemoving(false); // Only set back if removal failed
        }
    }, [paperId, currentUser, isRemoving, navigate, setUpdateError, setIsRemoving, setShowConfirmRemoveModal]);

    // --- Modal Openers ---
    // Open modal with the specific owner DB status to confirm
    const openConfirmStatusModal = (status: OwnerSettableImplementabilityStatus) => {
        setShowConfirmStatusModal({ show: true, status });
    };

    const openConfirmRemoveModal = () => {
        setShowConfirmRemoveModal(true);
    };

    // --- Modal Closers ---
    const closeConfirmStatusModal = () => {
        setShowConfirmStatusModal({ show: false, status: null });
    };

    const closeConfirmRemoveModal = () => {
        setShowConfirmRemoveModal(false);
    };

    return {
        paper,
        isLoading,
        error,
        updateError,
        setUpdateError, // Add this line
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
        reloadPaper: loadPaperAndActions
    };
}