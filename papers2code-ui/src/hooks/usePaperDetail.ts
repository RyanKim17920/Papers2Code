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
import { ImplementabilityAction } from '../types/paper'; // Import from types/paper.ts

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
    const [showConfirmStatusModal, setShowConfirmStatusModal] = useState<{ show: boolean; status: 'confirmed_non_implementable' | 'implementable' | null }>({ show: false, status: null });

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
            console.log(`Sending implementability vote to API: paperId=${paperId}, action=${action}`);
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

    const handleSetImplementabilityStatus = useCallback(async (isImplementable: boolean) => {
        if (!paperId || !currentUser || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        setUpdateError(null);
        setShowConfirmStatusModal({ show: false, status: null }); // Close modal first
        try {
            const updatedPaper = await setImplementabilityInApi(paperId, isImplementable);
            setPaper(updatedPaper);
        } catch (err) {
            console.error(`Failed to set implementability status to ${isImplementable}:`, err);
            setUpdateError(err instanceof Error ? err.message : `Failed to set status to ${isImplementable}.`);
        } finally {
            setIsUpdatingStatus(false);
        }
    }, [paperId, currentUser, isUpdatingStatus, setPaper, setUpdateError, setShowConfirmStatusModal]);

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
    const openConfirmStatusModal = (status: 'confirmed_non_implementable' | 'implementable') => {
        setShowConfirmStatusModal({ show: true, status: status });
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