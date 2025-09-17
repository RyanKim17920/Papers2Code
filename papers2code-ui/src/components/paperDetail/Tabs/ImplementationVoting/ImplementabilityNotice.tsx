import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Paper } from '../../../../common/types/paper';
import './ImplementabilityNotice.css';

interface ImplementabilityNoticeProps {
    paper: Paper;
}

const ImplementabilityNotice: React.FC<ImplementabilityNoticeProps> = ({ paper }) => {
    // Case 1: Paper is confirmed as Not Implementable
    // This is determined by paper.isImplementable === false (backend status is 'Not Implementable')
    if (paper.status === "Not Implementable") {
        return (
            <div className="not-implementable-notice confirmed">
                <strong>Confirmed Not-Implementable</strong>.
                This paper has been confirmed as not suitable for implementation on this platform.
            </div>
        );
    }

    if (paper.implementabilityStatus === "Admin Implementable") {
        return (
            <div className="implementable-notice confirmed">
                <strong>Confirmed Implementable</strong>.
                This paper has been confirmed as suitable for implementation on this platform.
            </div>
        );
    }


    // Case 2: Paper is currently considered implementable (paper.isImplementable === true),
    // but there are "Not Implementable" votes, indicating it's flagged by the community.
    if (paper.nonImplementableVotes > 0) {
        return (
            <div className="not-implementable-notice flagged">
                <p><strong>Flagged as Potentially Not-Implementable</strong></p>
                <p>
                    {paper.nonImplementableVotes} user(s) voted it as Not Implementable <span title="Not Implementable Votes"><ThumbsDown className="h-4 w-4 inline" /></span>.
                    {' '}{paper.isImplementableVotes} user(s) voted it as Implementable <span title="Is Implementable Votes"><ThumbsUp className="h-4 w-4 inline" /></span>.
                </p>
            </div>
        );
    }

    // No notice needed if paper.isImplementable is true and nonImplementableVotes is 0.
    return null;
};

export default ImplementabilityNotice;