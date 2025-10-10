import React, { useEffect, useState } from 'react';
import { ImplementationProgress, ProgressStatus, UpdateEventType } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import { useAuthorOutreachEmail } from '../../../../common/hooks/useAuthorOutreachEmail';
import { ImplementationProgressDialog } from './ImplementationProgressDialog';

interface ImplementationProgressProps {
    progress: ImplementationProgress;
    paperId: string;
    paperStatus: string; // The paper's overall status (from paper.status field)
    currentUser: UserProfile | null;
    onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
    onRefreshPaper: () => Promise<void>; // Function to refresh paper data
}

// This component is now just a wrapper that's kept for backwards compatibility
// The actual dialog is managed in ImplementationProgressCard
export const ImplementationProgressTab: React.FC<ImplementationProgressProps> = () => {
    // This component is no longer used directly - the dialog is opened from ImplementationProgressCard
    // Kept as an empty component to avoid breaking existing imports
    return null;
};
