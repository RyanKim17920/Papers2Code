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
        case 'confirmed_non_implementable':
            return 'status-confirmed-non-implementable';
        default:
            return 'status-unknown'; // Fallback for any other status
    }
};

/**
 * Returns an emoji symbol based on the paper's implementation status.
 * @param status - The implementation status string (e.g., 'Not Started', 'In Progress', 'Completed').
 * @returns A string containing an emoji symbol for the status.
 */
export const getStatusSymbol = (status: string | undefined | null): string => {
    if (!status) return '';
    switch (status) {
        case 'Not Started':
            return '⏳';
        case 'In Progress':
            return '🚧';
        case 'Completed':
            return '✅';
        case 'confirmed_non_implementable':
            return '🚫';
        default:
            return '';
    }
};
