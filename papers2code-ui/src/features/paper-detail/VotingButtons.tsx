import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Flag, CheckCircle, XCircle, ArrowUp } from 'lucide-react';
import { Paper, ImplementabilityAction, AdminSettableImplementabilityStatus, Status } from '@/shared/types/paper';
import { voteOnPaperInApi, flagImplementabilityInApi, setImplementabilityInApi, CsrfError, AuthenticationError } from '@/shared/services/api';
import type { UserProfile } from '@/shared/types/user';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import { useModal } from '@/shared/contexts/ModalContext';

export const FaArrowUp = () => <ArrowUp className="h-4 w-4" />;
export const FaThumbsUp = () => <ThumbsUp className="h-4 w-4" />;
export const FaThumbsDown = () => <ThumbsDown className="h-4 w-4" />;

// NEW: Define and export VoteButton and RetractVoteButton components
interface ActionButtonProps {
    onClick: () => void;
    disabled?: boolean;
    className?: string;
    title?: string;
    children?: React.ReactNode; // Allow children for text or other elements
}

export const VoteButton: React.FC<ActionButtonProps & { voted?: boolean; count?: number; icon?: React.ReactElement; text?: string }> = ({
    onClick,
    disabled,
    voted,
    count,
    icon,
    text,
    className,
    title,
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            voted 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        } ${className || ''}`}
        title={title}
    >
        {icon}
        {text && <span>{text}</span>}
        {typeof count === 'number' && <span className="font-semibold">{count}</span>}
    </button>
);

export const RetractVoteButton: React.FC<ActionButtonProps> = ({ onClick, disabled, className, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors ${className || ''}`}
        title={title || "Retract your vote"}
    >
        <Flag className="h-4 w-4" /> Retract Vote
    </button>
);
// END NEW

interface VotingButtonsProps {
    paper: Paper;
    onPaperUpdate: (updatedPaper: Paper) => void;
    onVoteProcessingChange?: (isProcessing: boolean) => void;
    currentUser: UserProfile | null;
}

const VotingButtons: React.FC<VotingButtonsProps> = ({ paper, onPaperUpdate, onVoteProcessingChange, currentUser }) => {
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [modalContent, setModalContent] = useState<{ title: string; children: React.ReactNode; onConfirm: () => void; confirmText: string; confirmButtonClass: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const { showLoginPrompt } = useModal();

    const handleVote = async (voteType: 'up' | 'none') => {
        if (isProcessing) return; // Early exit if already processing
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to vote.");
            return;
        }
        setIsProcessing(true);
        onVoteProcessingChange?.(true);
        try {
            const updatedPaper = await voteOnPaperInApi(paper.id, voteType);
            onPaperUpdate(updatedPaper);
        } catch (error) {
            // MODIFIED: Catch AuthenticationError as well
            if (error instanceof CsrfError || error instanceof AuthenticationError) {
                showLoginPrompt("Please connect with GitHub to vote.");
            } else {
                console.error("Error voting on paper:", error);
            }
        } finally {
            setIsProcessing(false);
            onVoteProcessingChange?.(false);
        }
    };

    const handleFlagAction = async (action: ImplementabilityAction) => {
        if (isProcessing) return;
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to perform this action.");
            return;
        }
        setIsProcessing(true);
        onVoteProcessingChange?.(true);
        try {
            const updatedPaper = await flagImplementabilityInApi(paper.id, action);
            onPaperUpdate(updatedPaper);
        } catch (error) {
            // MODIFIED: Catch AuthenticationError as well
            if (error instanceof CsrfError || error instanceof AuthenticationError) {
                showLoginPrompt("Please connect with GitHub to perform this action.");
            } else {
                console.error(`Error performing action ${action} on paper:`, error);
            }
        } finally {
            setIsProcessing(false);
            onVoteProcessingChange?.(false);
        }
    };

    const handleSetImplementability = async (statusToSet: AdminSettableImplementabilityStatus) => {
        if (isProcessing) return;
        if (!currentUser) {
            showLoginPrompt("Please connect with GitHub to set implementability.");
            return;
        }
        setIsProcessing(true);
        onVoteProcessingChange?.(true);
        try {
            const updatedPaper = await setImplementabilityInApi(paper.id, statusToSet);
            onPaperUpdate(updatedPaper);
        } catch (error) {
            // MODIFIED: Catch AuthenticationError as well
            if (error instanceof CsrfError || error instanceof AuthenticationError) {
                showLoginPrompt("Please connect with GitHub to set implementability.");
            } else {
                console.error(`Error setting implementability to ${statusToSet}:`, error);
            }
        } finally {
            setIsProcessing(false);
            onVoteProcessingChange?.(false);
        }
    };

    const handleFlagClick = (action: ImplementabilityAction) => {
        let actionText = '';
        switch (action) {
            case 'confirm': actionText = 'confirm this paper as implementable'; break;
            case 'dispute': actionText = 'dispute this paper and mark as not implementable'; break;
            case 'retract': actionText = 'retract your implementability vote'; break;
            // default: actionText = 'perform this action'; // Default case not strictly needed if all actions are covered
        }
        setModalContent({
            title: 'Confirm Action',
            children: <p>Are you sure you want to {actionText}?</p>,
            onConfirm: () => {
                handleFlagAction(action);
                setShowConfirmModal(false);
            },
            confirmText: 'Confirm',
            confirmButtonClass: 'button-danger' 
        });
        setShowConfirmModal(true);
    };

    const handleSetImplementabilityClick = (statusToSet: AdminSettableImplementabilityStatus) => {
        let statusText = '';
        switch (statusToSet) {
            case 'Admin Implementable': statusText = 'Confirmed Implementable'; break;
            case 'Admin Not Implementable': statusText = 'Confirmed Not-Implementable'; break;
            case 'Voting': statusText = 'Open for Voting (community decides)'; break;
            // default: statusText = 'update the status'; // Default case not strictly needed
        }
        setModalContent({
            title: 'Confirm Status Change',
            children: <p>Are you sure you want to set the implementability status to "{statusText}"?</p>,
            onConfirm: () => {
                handleSetImplementability(statusToSet);
                setShowConfirmModal(false);
            },
            confirmText: 'Confirm Change',
            confirmButtonClass: 'button-primary'
        });
        setShowConfirmModal(true);
    };

    const userVote = paper.currentUserVote;
    const voteCount = paper.upvoteCount;
    const isOwnedByCurrentUser = currentUser?.username && paper.authors?.includes(currentUser.username);

    // These are specific string literals that the Status type can be.
    const ownerSetImplementableStatus: Status = "Completed"; // Example: Or map to a specific status like 'Official Code Posted' or a custom one if added
    const ownerSetNonImplementableStatus: Status = "Not Implementable";

    return (
        <div className="flex flex-wrap gap-3">
            {/* MODIFIED: Use the exported VoteButton component */}
            <VoteButton
                onClick={() => handleVote(userVote === 'up' ? 'none' : 'up')}
                voted={userVote === 'up'}
                disabled={isProcessing}
                title={userVote === 'up' ? 'Remove Vote' : (currentUser ? 'Vote Up' : 'Connect to Vote')}
                icon={<ThumbsUp className={`h-4 w-4 ${userVote === 'up' ? 'fill-current' : ''}`} />}
                count={voteCount}
            />

            {/* Implementability flagging/voting buttons for non-owners */}
            {currentUser && !isOwnedByCurrentUser && (
                <>
                    {paper.currentUserImplementabilityVote === 'none' && (
                        <>
                            <button 
                                onClick={() => handleFlagClick('confirm')} 
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                                disabled={isProcessing}
                                title="Vote: Implementable"
                            >
                                <ThumbsUp className="h-4 w-4" /> Vote Implementable
                            </button>
                            <button 
                                onClick={() => handleFlagClick('dispute')} 
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                                disabled={isProcessing}
                                title="Vote: Not Implementable"
                            >
                                <ThumbsDown className="h-4 w-4" /> Vote Not Implementable
                            </button>
                        </>
                    )}
                    {(paper.currentUserImplementabilityVote === 'up' || paper.currentUserImplementabilityVote === 'down') && (
                        // MODIFIED: Use the exported RetractVoteButton component
                        <RetractVoteButton 
                            onClick={() => handleFlagClick('retract')} 
                            disabled={isProcessing}
                        />
                    )}
                </>
            )}

            {/* Owner-specific implementability setting buttons */}
            {currentUser && isOwnedByCurrentUser && (
                <>
                    {/* Button to set as Implementable by Owner */}
                    {paper.status !== ownerSetImplementableStatus && paper.status !== 'Official Code Posted' && (
                         <button 
                            onClick={() => handleSetImplementabilityClick('Admin Implementable')} 
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                            disabled={isProcessing}
                            title="Owner: Set as Implementable (overrides votes)"
                        >
                            <CheckCircle className="h-4 w-4" /> Owner: Set Implementable
                        </button>
                    )}
                    {/* Button to set as Not Implementable by Owner */}
                    {paper.status !== ownerSetNonImplementableStatus && (
                        <button 
                            onClick={() => handleSetImplementabilityClick('Admin Not Implementable')} 
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                            disabled={isProcessing}
                            title="Owner: Set as Not Implementable (overrides votes)"
                        >
                            <XCircle className="h-4 w-4" /> Owner: Set Not Implementable
                        </button>
                    )}
                    {/* Button to revert to community voting */}
                    {(paper.status === ownerSetImplementableStatus || paper.status === ownerSetNonImplementableStatus) && (
                         <button 
                            onClick={() => handleSetImplementabilityClick('Voting')} 
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                            disabled={isProcessing}
                            title="Owner: Revert to community voting (current status will be reset)"
                        >
                            <Flag className="h-4 w-4" /> Owner: Revert to Voting
                        </button>
                    )}
                </>
            )}


            {showConfirmModal && modalContent && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setShowConfirmModal(false)}
                    title={modalContent.title}
                    onConfirm={modalContent.onConfirm}
                    confirmText={modalContent.confirmText}
                    confirmButtonClass={modalContent.confirmButtonClass}
                >
                    {modalContent.children}
                </ConfirmationModal>
            )}
        </div>
    );
};

export default VotingButtons;
