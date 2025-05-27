import React from 'react';
import { FaArrowUp, FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import './VotingButtons.css';

interface VotingButtonProps {
    onClick: () => void;
    disabled?: boolean;
    voted?: boolean;
    count?: number;
    icon: React.ReactNode;
    text: string;
    className?: string;
    title?: string;
}

const VoteButton: React.FC<VotingButtonProps> = ({ onClick, disabled, voted, count, icon, text, className, title }) => (
    <button
        className={`vote-button ${className || ''} ${voted ? 'voted' : ''}`}
        onClick={onClick}
        disabled={disabled}
        title={title}
    >
        {icon}
        <span>{text}</span>
        {typeof count === 'number' && <span className="vote-count">{count}</span>}
    </button>
);

interface RetractVoteButtonProps {
    onClick: () => void;
    disabled?: boolean;
}

const RetractVoteButton: React.FC<RetractVoteButtonProps> = ({ onClick, disabled }) => (
    <button className="button-link retract-vote-button" onClick={onClick} disabled={disabled}>
        Retract Vote
    </button>
);

export { VoteButton, RetractVoteButton, FaArrowUp, FaThumbsUp, FaThumbsDown };
