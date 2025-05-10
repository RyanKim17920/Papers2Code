import React from 'react';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { Paper } from '../../types/paper'; // Assuming Paper type
import './ImplementabilityNotice.css';

interface ImplementabilityNoticeProps {
    paper: Paper;
}

const ImplementabilityNotice: React.FC<ImplementabilityNoticeProps> = ({ paper }) => {
    if (paper.nonImplementableStatus === 'confirmed_non_implementable') {
        return (
            <div className="not-implementable-notice confirmed">
                <strong>Confirmed Non-Implementable</strong> by {paper.nonImplementableConfirmedBy || 'unknown'}.
                This paper has been confirmed as not suitable for implementation on this platform.
            </div>
        );
    }

    if (paper.nonImplementableStatus === 'flagged_non_implementable') {
        return (
            <div className="not-implementable-notice flagged">
                <p><strong>Flagged as Potentially Non-Implementable</strong></p>
                <p>
                    {paper.nonImplementableVotes} user(s) flagged this <FaThumbsUp />, {paper.disputeImplementableVotes} user(s) disagree <FaThumbsDown />.
                    The owner can confirm or revert this status.
                </p>
            </div>
        );
    }

    if (paper.nonImplementableStatus === 'implementable' && paper.isImplementable === false) {
        return (
            <div className="implementable-notice">
                This paper was previously flagged or confirmed as non-implementable, but the status has been reverted. It is currently considered implementable.
            </div>
        );
    }

    return null; // No notice needed for other cases
};

export default ImplementabilityNotice;