// filepath: c:\Users\ilove\CODING\Papers-2-code\papers2code-ui\src\components\PaperDetailComponents\ImplementabilityNotice.tsx
import React from 'react';
import { PaperNonImplementableStatus } from '../../types/paperTypes';
import { UserProfile } from '../../services/auth';

interface ImplementabilityNoticeProps {
    status: PaperNonImplementableStatus;
    confirmedBy: UserProfile | null; // User who confirmed it (if applicable)
}

const ImplementabilityNotice: React.FC<ImplementabilityNoticeProps> = ({ status, confirmedBy }) => {
    if (status === 'implementable') {
        // Optionally render a positive notice or nothing
        return (
            <div className="implementable-notice">
                <p>This paper is marked as implementable.</p>
            </div>
        );
    }

    if (status === 'flagged') {
        return (
            <div className="not-implementable-notice flagged">
                <p><strong>Flagged as Potentially Non-Implementable:</strong> This paper has been flagged by a user as potentially lacking sufficient detail for implementation. Further review or confirmation is encouraged.</p>
            </div>
        );
    }

    if (status === 'confirmed') {
        return (
            <div className="not-implementable-notice confirmed">
                <p><strong>Confirmed Non-Implementable:</strong> This paper has been confirmed by <strong>{confirmedBy?.username || 'an administrator'}</strong> as lacking sufficient detail for implementation based on community feedback or review.</p>
            </div>
        );
    }

    return null; // Should not happen with defined statuses
};

export default ImplementabilityNotice;
