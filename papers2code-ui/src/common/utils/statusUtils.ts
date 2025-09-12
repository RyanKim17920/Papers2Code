// src/utils/statusUtils.ts
import { Paper } from '../types/paper';
/**
 * Returns a CSS class string based on the paper's status and implementability votes.
 * @param paper - The paper object.
 * @returns A string containing CSS class(es) for styling.
 */
export const getStatusClass = (paper: Paper | undefined | null): string => {
    if (!paper || !paper.status) return 'status-unknown';

    if (paper.status === 'Not Started' && paper.nonImplementableVotes > 0 && paper.implementabilityStatus === 'Voting') {
        return 'status-not-started-disputed';
    }

    switch (paper.status) {
        case 'Not Implementable':
            return 'status-not-implementable';
        case 'Not Started':
            return 'status-not-started';
        case 'Started':
            return 'status-started';
        case 'Waiting for Author Response':
            return 'status-waiting-author';
        case 'Work in Progress':
            return 'status-in-progress';
        case 'Waiting for Review':
            return 'status-waiting-review';
        case 'Completed':
            return 'status-completed';
        case 'Official Code Posted':
            return 'status-official-code';
        default:
            return 'status-unknown';
    }
};

/**
 * Returns an emoji symbol based on the paper's status and implementability votes.
 * @param paper - The paper object.
 * @returns A string containing an emoji symbol for the status.
 */
// getStatusSymbol removed in favor of clean text-only badge styling.
