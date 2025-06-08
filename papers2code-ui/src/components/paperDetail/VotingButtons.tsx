import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbsUp as faSolidThumbsUp, faFlag, faCheckCircle, faTimesCircle, faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { faThumbsUp as faRegularThumbsUp, faThumbsDown as faRegularThumbsDown } from '@fortawesome/free-regular-svg-icons';
import { Paper, ImplementabilityAction, AdminSettableImplementabilityStatus, Status } from '../../types/paper';
import { voteOnPaperInApi, flagImplementabilityInApi, setImplementabilityInApi, CsrfError, AuthenticationError } from '../../services/api';
import type { UserProfile } from '../../types/user';
import ConfirmationModal from '../common/ConfirmationModal';
import './VotingButtons.css';
import { useModal } from '../../context/ModalContext';

export const FaArrowUp = () => <FontAwesomeIcon icon={faArrowUp} />;
export const FaThumbsUp = () => <FontAwesomeIcon icon={faRegularThumbsUp} />;
export const FaThumbsDown = () => <FontAwesomeIcon icon={faRegularThumbsDown} />;

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
        className={`vote-button ${voted ? 'voted' : ''} ${className || ''}`}
        title={title}
    >
        {icon}
        {text && <span className="button-text">{text}</span>}
        {typeof count === 'number' && <span className="vote-count">{count}</span>}
    </button>
);

export const RetractVoteButton: React.FC<ActionButtonProps> = ({ onClick, disabled, className, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flag-button retract-vote ${className || ''}`}
        title={title || "Retract your vote"}
    >
        <FontAwesomeIcon icon={faFlag} /> Retract Vote
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
        <div className="voting-buttons-container">
            {/* MODIFIED: Use the exported VoteButton component */}
            <VoteButton
                onClick={() => handleVote(userVote === 'up' ? 'none' : 'up')}
                voted={userVote === 'up'}
                disabled={isProcessing}
                title={userVote === 'up' ? 'Remove Vote' : (currentUser ? 'Vote Up' : 'Connect to Vote')}
                icon={<FontAwesomeIcon icon={userVote === 'up' ? faSolidThumbsUp : faRegularThumbsUp} />}
                count={voteCount}
            />

            {/* Implementability flagging/voting buttons for non-owners */}
            {currentUser && !isOwnedByCurrentUser && (
                <>
                    {paper.currentUserImplementabilityVote === 'none' && (
                        <>
                            <button 
                                onClick={() => handleFlagClick('confirm')} 
                                className="flag-button confirm-implementable"
                                disabled={isProcessing}
                                title="Vote: Implementable"
                            >
                                <FontAwesomeIcon icon={faRegularThumbsUp} /> Vote Implementable
                            </button>
                            <button 
                                onClick={() => handleFlagClick('dispute')} 
                                className="flag-button dispute-implementable"
                                disabled={isProcessing}
                                title="Vote: Not Implementable"
                            >
                                <FontAwesomeIcon icon={faRegularThumbsDown} /> Vote Not Implementable
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
                            className="set-status-button implementable"
                            disabled={isProcessing}
                            title="Owner: Set as Implementable (overrides votes)"
                        >
                            <FontAwesomeIcon icon={faCheckCircle} /> Owner: Set Implementable
                        </button>
                    )}
                    {/* Button to set as Not Implementable by Owner */}
                    {paper.status !== ownerSetNonImplementableStatus && (
                        <button 
                            onClick={() => handleSetImplementabilityClick('Admin Not Implementable')} 
                            className="set-status-button not-implementable-owner"
                            disabled={isProcessing}
                            title="Owner: Set as Not Implementable (overrides votes)"
                        >
                            <FontAwesomeIcon icon={faTimesCircle} /> Owner: Set Not Implementable
                        </button>
                    )}
                    {/* Button to revert to community voting */}
                    {(paper.status === ownerSetImplementableStatus || paper.status === ownerSetNonImplementableStatus) && (
                         <button 
                            onClick={() => handleSetImplementabilityClick('Voting')} 
                            className="set-status-button revert-to-voting-owner"
                            disabled={isProcessing}
                            title="Owner: Revert to community voting (current status will be reset)"
                        >
                            <FontAwesomeIcon icon={faFlag} /> Owner: Revert to Voting
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
