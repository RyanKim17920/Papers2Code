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
 * Returns Tailwind color classes for status badges based on paper status.
 * Consistent with PaperCard.css color scheme.
 * @param status - The status string.
 * @returns A string containing Tailwind classes for background, text, and border colors.
 */
export const getStatusColorClasses = (status: string): string => {
    switch (status) {
        case 'Official Code Posted':
        case 'Completed':
            // Green - matches .status-official-code and .status-completed
            return 'bg-green-500/10 text-green-700 border-green-500/20';
        
        case 'Work in Progress':
        case 'In Progress':
            // Blue - matches .status-in-progress
            return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
        
        case 'Started':
            // Cyan/Blue - matches .status-started
            return 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20';
        
        case 'Waiting for Author Response':
            // Yellow/Orange - matches .status-waiting-author
            return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
        
        case 'Waiting for Review':
            // Purple - distinct for review state
            return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
        
        case 'Not Implementable':
        case 'No Response':
        case 'Refused to Upload':
            // Red - matches .status-non-implementable
            return 'bg-red-500/10 text-red-700 border-red-500/20';
        
        case 'Not Started':
            // Gray - matches .status-not-started
            return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
        
        case 'Response Received':
        case 'Code Uploaded':
            // Green - positive responses
            return 'bg-green-500/10 text-green-700 border-green-500/20';
        
        case 'Code Needs Refactoring':
            // Orange - needs attention
            return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
        
        default:
            // Muted gray for unknown statuses
            return 'bg-muted/50 text-muted-foreground border-border';
    }
};

/**
 * Returns a hex color code for status indicators (for charts, dots, etc.)
 * @param status - The status string.
 * @returns A hex color string.
 */
export const getStatusColorHex = (status: string): string => {
    switch (status) {
        case 'Official Code Posted':
        case 'Completed':
        case 'Response Received':
        case 'Code Uploaded':
        case 'Published':
            return '#28a745'; // Green
        
        case 'Work in Progress':
        case 'In Progress':
            return '#ffc107'; // Yellow
        
        case 'Started':
        case 'Submitted':
            return '#007bff'; // Blue
        
        case 'Waiting for Author Response':
            return '#f59e0b'; // Amber/Orange
        
        case 'Not Started':
        default:
            return '#6c757d'; // Gray
    }
};

/**
 * Returns an emoji symbol based on the paper's status and implementability votes.
 * @param paper - The paper object.
 * @returns A string containing an emoji symbol for the status.
 */
// getStatusSymbol removed in favor of clean text-only badge styling.
