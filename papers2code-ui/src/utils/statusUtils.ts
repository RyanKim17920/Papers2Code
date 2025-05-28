// src/utils/statusUtils.ts
import { Status } from '../types/paper';
/**
 * Returns a CSS class string based on the paper's implementation status.
 * @param status - The implementation status string.
 * @returns A string containing CSS class(es) for styling.
 */
export const getStatusClass = (status: Status | undefined | null): string => {
    if (!status) return 'status-unknown';

    switch (status) {
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
        case 'Completed':
            return 'status-completed';
        case 'Official Code Posted':
            return 'status-official-code';
        default:
            return 'status-unknown';
    }
};

/**
 * Returns an emoji symbol based on the paper's implementation status.
 * @param status - The implementation status string.
 * @returns A string containing an emoji symbol for the status.
 */
export const getStatusSymbol = (status: Status | undefined | null): string => {
    if (!status) return '';
    switch (status) {
        case 'Not Implementable':
            return '🚫';
        case 'Not Started':
            return '⏳';
        case 'Started':
            return '🚀';
        case 'Waiting for Author Response':
            return '✉️';
        case 'Work in Progress':
            return '🚧';
        case 'Completed':
            return '✅';
        case 'Official Code Posted':
            return '📦';
        default:
            return '';
    }
};
