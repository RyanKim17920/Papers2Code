import React, { useState, useEffect, useCallback } from 'react';
import { ImplementationProgress, EmailStatus } from '../../../../common/types/implementation';
import './ImplementationProgressTab.css';

interface ImplementationProgressProps {
    progress: ImplementationProgress;
    onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
}

export const ImplementationProgressTab: React.FC<ImplementationProgressProps> = ({ 
    progress, 
    onImplementationProgressChange 
}) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [githubRepoValue, setGithubRepoValue] = useState(progress.githubRepoId || '');
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<EmailStatus | null>(null);
    const [showResponseModal, setShowResponseModal] = useState(false);

    // Update local state when progress changes
    useEffect(() => {
        setGithubRepoValue(progress.githubRepoId || '');
    }, [progress.githubRepoId]);

    // Check for automatic status update to "No Response"
    useEffect(() => {
        const checkAutoNoResponse = async () => {
            if (progress.emailStatus === EmailStatus.SENT && 
                progress.emailSentAt && 
                hasReachedNoResponseTime()) {
                
                // Automatically update to No Response
                try {
                    const updatedProgress: ImplementationProgress = {
                        ...progress,
                        emailStatus: EmailStatus.NO_RESPONSE,
                        updatedAt: new Date().toISOString()
                    };
                    await onImplementationProgressChange(updatedProgress);
                } catch (err) {
                    console.error('Failed to auto-update to No Response:', err);
                }
            }
        };

        checkAutoNoResponse();
    }, [progress.emailStatus, progress.emailSentAt, onImplementationProgressChange]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [debounceTimer]);

    if (!progress) {
        return (
            <div className="implementation-progress-view">
                <p>No implementation progress data available.</p>
            </div>
        );
    }

    // Debug logging to see what the progress object looks like
    console.log('ImplementationProgressTab: progress object:', progress);
    console.log('ImplementationProgressTab: progress.id:', progress.id);

    const handleEmailStatusUpdate = async (newStatus: EmailStatus) => {
        if (newStatus === EmailStatus.RESPONSE_RECEIVED) {
            // Show response options modal instead of direct update
            setShowResponseModal(true);
            return;
        }
        
        // For other statuses, show confirmation modal
        setPendingStatus(newStatus);
        setShowConfirmModal(true);
    };

    const handleResponseTypeSelection = async (responseType: EmailStatus) => {
        setShowResponseModal(false);
        setIsUpdating(true);
        setError(null);

        try {
            const updatedProgress: ImplementationProgress = {
                ...progress,
                emailStatus: responseType,
                updatedAt: new Date().toISOString()
            };
            
            await onImplementationProgressChange(updatedProgress);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update response type');
        } finally {
            setIsUpdating(false);
        }
    };

    const confirmStatusUpdate = async () => {
        if (!pendingStatus) return;
        
        setIsUpdating(true);
        setError(null);
        setShowConfirmModal(false);

        try {
            // Create updated progress object
            const updatedProgress: ImplementationProgress = {
                ...progress,
                emailStatus: pendingStatus,
                updatedAt: new Date().toISOString()
            };
            
            // Call parent handler which will handle the API call through the hook
            await onImplementationProgressChange(updatedProgress);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update email status');
        } finally {
            setIsUpdating(false);
            setPendingStatus(null);
        }
    };

    const cancelStatusUpdate = () => {
        setShowConfirmModal(false);
        setPendingStatus(null);
    };

    const handleGithubRepoUpdate = async (githubRepoId: string) => {
        setIsUpdating(true);
        setError(null);

        try {
            // Create updated progress object
            const updatedProgress: ImplementationProgress = {
                ...progress,
                githubRepoId,
                updatedAt: new Date().toISOString()
            };
            
            // Call parent handler which will handle the API call through the hook
            await onImplementationProgressChange(updatedProgress);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update GitHub repository');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleGithubRepoInputChange = useCallback((value: string) => {
        setGithubRepoValue(value);
        
        // Clear existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        // Set new timer to update after 1 second of no changes
        const newTimer = setTimeout(() => {
            if (value !== progress.githubRepoId) {
                handleGithubRepoUpdate(value);
            }
        }, 1000);
        
        setDebounceTimer(newTimer);
    }, [debounceTimer, progress.githubRepoId]);

    const getEmailStatusIcon = (status: EmailStatus) => {
        switch (status) {
            case EmailStatus.NOT_SENT:
                return '📧';
            case EmailStatus.SENT:
                return '✉️';
            case EmailStatus.RESPONSE_RECEIVED:
                return '📬';
            case EmailStatus.CODE_UPLOADED:
                return '✅';
            case EmailStatus.CODE_NEEDS_REFACTORING:
                return '🔧';
            case EmailStatus.REFUSED_TO_UPLOAD:
                return '❌';
            case EmailStatus.NO_RESPONSE:
                return '📭';
            default:
                return '📧';
        }
    };

    const getEmailStatusColor = (status: EmailStatus) => {
        switch (status) {
            case EmailStatus.NOT_SENT:
                return '#6b7280'; // gray
            case EmailStatus.SENT:
                return '#f59e0b'; // amber
            case EmailStatus.RESPONSE_RECEIVED:
                return '#3b82f6'; // blue
            case EmailStatus.CODE_UPLOADED:
                return '#10b981'; // green
            case EmailStatus.CODE_NEEDS_REFACTORING:
                return '#f59e0b'; // amber
            case EmailStatus.REFUSED_TO_UPLOAD:
                return '#ef4444'; // red
            case EmailStatus.NO_RESPONSE:
                return '#ef4444'; // red
            default:
                return '#6b7280';
        }
    };

    const getNextAllowedStatuses = (currentStatus: EmailStatus): EmailStatus[] => {
        switch (currentStatus) {
            case EmailStatus.NOT_SENT:
                return [EmailStatus.SENT];
            case EmailStatus.SENT:
                // Only show Response Received button, No Response happens automatically
                return [EmailStatus.RESPONSE_RECEIVED];
            case EmailStatus.RESPONSE_RECEIVED:
            case EmailStatus.CODE_UPLOADED:
            case EmailStatus.CODE_NEEDS_REFACTORING:
            case EmailStatus.REFUSED_TO_UPLOAD:
            case EmailStatus.NO_RESPONSE:
                return []; // End states - no further manual progression
            default:
                return [];
        }
    };

    const hasReachedNoResponseTime = (): boolean => {
        if (!progress.emailSentAt) return false;
        
        const sentDate = new Date(progress.emailSentAt);
        const now = new Date();
        const fourWeeksInMs = 4 * 7 * 24 * 60 * 60 * 1000; // 4 weeks in milliseconds
        
        return (now.getTime() - sentDate.getTime()) >= fourWeeksInMs;
    };

    const getTimeUntilNoResponse = (): { days: number; hours: number; minutes: number } | null => {
        if (!progress.emailSentAt || hasReachedNoResponseTime()) return null;
        
        const sentDate = new Date(progress.emailSentAt);
        const now = new Date();
        const fourWeeksInMs = 4 * 7 * 24 * 60 * 60 * 1000;
        const timePassedMs = now.getTime() - sentDate.getTime();
        const timeRemainingMs = fourWeeksInMs - timePassedMs;
        
        const days = Math.floor(timeRemainingMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeRemainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((timeRemainingMs % (60 * 60 * 1000)) / (60 * 1000));
        
        return { days, hours, minutes };
    };

    const getStatusConfirmationMessage = (status: EmailStatus): string => {
        switch (status) {
            case EmailStatus.SENT:
                return "Are you sure you want to mark the email as sent? This means you have contacted the paper's authors about implementing their work. A 4-week cooldown period will start.";
            case EmailStatus.RESPONSE_RECEIVED:
                return "Are you sure the authors have responded? This means you received a reply from the paper's authors. You'll then be able to specify the nature of their response.";
            case EmailStatus.CODE_UPLOADED:
                return "Are you sure the authors uploaded their code? This means the authors have published their implementation and it's ready to use.";
            case EmailStatus.CODE_NEEDS_REFACTORING:
                return "Are you sure the code needs refactoring? This means the authors uploaded code but it needs improvement or cleanup.";
            case EmailStatus.REFUSED_TO_UPLOAD:
                return "Are you sure the authors refused to upload their code? This means they declined to share their implementation.";
            case EmailStatus.NO_RESPONSE:
                return "Are you sure there was no response? This means you haven't received a reply from the authors after the 4-week waiting period.";
            default:
                return `Are you sure you want to update the status to ${status}?`;
        }
    };

    const shouldShowGithubField = () => {
        return progress.emailStatus === EmailStatus.CODE_UPLOADED || 
               progress.emailStatus === EmailStatus.CODE_NEEDS_REFACTORING ||
               progress.emailStatus === EmailStatus.REFUSED_TO_UPLOAD ||
               progress.emailStatus === EmailStatus.NO_RESPONSE;
    };

    return (
        <div className="implementation-progress-view">
            <h2>Implementation Progress</h2>
            
            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {/* Email Status Tracker */}
            <div className="email-tracker">
                <h3>Author Contact Status</h3>
                
                {/* Cooldown Timer */}
                {progress.emailStatus === EmailStatus.SENT && !hasReachedNoResponseTime() && (
                    <div className="cooldown-timer">
                        <h4>Waiting for Author Response</h4>
                        <p>Status will automatically change to "No Response" if no reply is received within 4 weeks.</p>
                        {(() => {
                            const timeLeft = getTimeUntilNoResponse();
                            return timeLeft ? (
                                <div className="timer-display">
                                    <span className="timer-value">{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m</span>
                                    <span className="timer-label">until auto "No Response"</span>
                                </div>
                            ) : null;
                        })()}
                    </div>
                )}
                
                <div className="email-status-steps">
                    {Object.values(EmailStatus).map((status) => {
                        const isCurrentStatus = progress.emailStatus === status;
                        const allowedNextStatuses = getNextAllowedStatuses(progress.emailStatus);
                        const canMoveTo = allowedNextStatuses.includes(status);
                        
                        return (
                            <div 
                                key={status}
                                className={`email-step ${isCurrentStatus ? 'active' : ''} ${canMoveTo ? 'available' : 'disabled'}`}
                                style={{ 
                                    color: isCurrentStatus ? getEmailStatusColor(status) : '#6b7280'
                                }}
                            >
                                <div className="email-step-icon">
                                    {getEmailStatusIcon(status)}
                                </div>
                                <div className="email-step-label">{status}</div>
                                {canMoveTo && (
                                    <button
                                        className="email-step-button"
                                        onClick={() => handleEmailStatusUpdate(status)}
                                        disabled={isUpdating}
                                        title={`Mark as ${status}`}
                                    >
                                        {status === EmailStatus.RESPONSE_RECEIVED ? 
                                            'Authors Responded' : 
                                            `Mark as ${status}`
                                        }
                                    </button>
                                )}
                                {isCurrentStatus && (
                                    <div className="current-status-indicator">Current</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* GitHub Repository Field - Only show if email was responded to or no response */}
            {shouldShowGithubField() && (
                <div className="github-repo-section">
                    <h3>Implementation Repository</h3>
                    <div className="github-repo-field">
                        <label htmlFor="github-repo">GitHub Repository ID:</label>
                        <input
                            id="github-repo"
                            type="text"
                            value={githubRepoValue}
                            onChange={(e) => handleGithubRepoInputChange(e.target.value)}
                            placeholder="e.g., username/repo-name"
                            disabled={isUpdating}
                            className="github-repo-input"
                        />
                        <small className="github-repo-help">
                            Enter the GitHub repository where the implementation will be hosted
                        </small>
                    </div>
                </div>
            )}

            {/* Progress Info */}
            <div className="progress-info">
                <p><strong>Started by:</strong> {progress.initiatedBy}</p>
                <p><strong>Contributors:</strong> {progress.contributors.length}</p>
                <p><strong>Created:</strong> {new Date(progress.createdAt).toLocaleDateString()}</p>
                <p><strong>Last updated:</strong> {new Date(progress.updatedAt).toLocaleDateString()}</p>
            </div>

            {/* Response Type Selection Modal */}
            {showResponseModal && (
                <div className="modal-overlay">
                    <div className="modal-content response-modal">
                        <h3>What was the author's response?</h3>
                        <p>Please select the type of response you received from the paper's authors:</p>
                        <div className="response-options">
                            <button 
                                className="response-option code-uploaded"
                                onClick={() => handleResponseTypeSelection(EmailStatus.CODE_UPLOADED)}
                                disabled={isUpdating}
                            >
                                <div className="response-icon">✅</div>
                                <div className="response-title">Code Uploaded</div>
                                <div className="response-description">Authors published their working implementation</div>
                            </button>
                            <button 
                                className="response-option code-needs-work"
                                onClick={() => handleResponseTypeSelection(EmailStatus.CODE_NEEDS_REFACTORING)}
                                disabled={isUpdating}
                            >
                                <div className="response-icon">🔧</div>
                                <div className="response-title">Code Needs Refactoring</div>
                                <div className="response-description">Authors shared code but it needs improvement</div>
                            </button>
                            <button 
                                className="response-option refused"
                                onClick={() => handleResponseTypeSelection(EmailStatus.REFUSED_TO_UPLOAD)}
                                disabled={isUpdating}
                            >
                                <div className="response-icon">❌</div>
                                <div className="response-title">Refused to Upload</div>
                                <div className="response-description">Authors declined to share their implementation</div>
                            </button>
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="btn-secondary" 
                                onClick={() => setShowResponseModal(false)}
                                disabled={isUpdating}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && pendingStatus && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Confirm Status Update</h3>
                        <p>{getStatusConfirmationMessage(pendingStatus)}</p>
                        <div className="modal-actions">
                            <button 
                                className="btn-secondary" 
                                onClick={cancelStatusUpdate}
                                disabled={isUpdating}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-primary" 
                                onClick={confirmStatusUpdate}
                                disabled={isUpdating}
                            >
                                {isUpdating ? 'Updating...' : `Confirm ${pendingStatus}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
