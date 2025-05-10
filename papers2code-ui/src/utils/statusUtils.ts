// src/utils/statusUtils.ts

/**
 * Returns a CSS class string based on the paper's implementation status.
 * @param status - The implementation status string (e.g., 'Not Started', 'In Progress', 'Completed').
 * @returns A string containing CSS class(es) for styling.
 */
export const getStatusClass = (status: string | undefined | null): string => {
    if (!status) return 'status-unknown'; // Default class if status is undefined or null

    switch (status) {
        case 'Not Started':
            return 'status-not-started';
        case 'In Progress':
            return 'status-in-progress';
        case 'Completed':
            return 'status-completed';
        // Add more cases for other statuses if needed
        // e.g., for nonImplementableStatus:
        case 'flagged_non_implementable':
            return 'status-flagged-non-implementable';
        case 'confirmed_non_implementable':
            return 'status-confirmed-non-implementable';
        case 'pending_community_confirmation':
            return 'status-pending-confirmation';
        case 'implementable': // Explicitly implementable
            return 'status-implementable';
        default:
            return 'status-unknown'; // Fallback for any other status
    }
};
