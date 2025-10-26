import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Paper } from '../../../../common/types/paper';

interface ImplementabilityNoticeProps {
    paper: Paper;
}

const ImplementabilityNotice: React.FC<ImplementabilityNoticeProps> = ({ paper }) => {
    // Case 1: Paper is confirmed as Not Implementable
    // This is determined by paper.isImplementable === false (backend status is 'Not Implementable')
    if (paper.status === "Not Implementable") {
        return (
            <div className="px-5 py-3.5 rounded-lg mb-5 text-[0.95em] border leading-relaxed bg-[var(--danger-light-color,#ffebee)] border-[var(--danger-color,#e53935)] text-[var(--danger-dark-color,#c62828)]">
                <strong>Confirmed Not-Implementable</strong>.
                This paper has been confirmed as not suitable for implementation on this platform.
            </div>
        );
    }

    if (paper.implementabilityStatus === "Admin Implementable") {
        return (
            <div className="px-5 py-3.5 rounded-lg mb-5 text-[0.95em] border leading-relaxed bg-[var(--info-light-color,#e7f3ff)] border-[var(--info-color,#007bff)] text-[var(--info-dark-color,#0056b3)]">
                <strong>Confirmed Implementable</strong>.
                This paper has been confirmed as suitable for implementation on this platform.
            </div>
        );
    }


    // Case 2: Paper is currently considered implementable (paper.isImplementable === true),
    // but there are "Not Implementable" votes, indicating it's flagged by the community.
    if (paper.nonImplementableVotes > 0) {
        return (
            <div className="px-5 py-3.5 rounded-lg mb-5 text-[0.95em] border leading-relaxed bg-[var(--warning-light-color,#fff8e1)] border-[var(--warning-color,#ffc107)] text-[var(--warning-dark-color,#b78100)]">
                <p className="my-1.5"><strong>Flagged as Potentially Not-Implementable</strong></p>
                <p className="my-1.5">
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