import React, { useState, useEffect, useCallback } from 'react';
import { ImplementationProgress, EmailStatus } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import ConfirmationModal from '../../../../common/components/ConfirmationModal';
import Modal from '../../../../common/components/Modal';
import { UserDisplayList } from '../../../paperDetail/UserDisplayList';
import { useContributorProfiles } from '../../../../common/hooks/useContributorProfiles';
import './ImplementationProgressTab.css';

interface ImplementationProgressProps {
    progress: ImplementationProgress;
    currentUser: UserProfile | null;
    onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
}

export const ImplementationProgressTab: React.FC<ImplementationProgressProps> = ({ 
    progress, 
    currentUser,
    onImplementationProgressChange 
}) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [githubRepoValue, setGithubRepoValue] = useState(progress.githubRepoId || '');
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<EmailStatus | null>(null);
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [isEditingRepo, setIsEditingRepo] = useState(false);
    const [showContributorsModal, setShowContributorsModal] = useState(false);

    // Fetch real contributor user profiles
    const { contributorUsers, isLoading: isLoadingContributors, error: contributorError } = useContributorProfiles({
        contributorIds: progress.contributors,
        enabled: true
    });

    // Permission helpers
    const isLoggedIn = !!currentUser;
    const isContributor = isLoggedIn && progress.contributors.includes(currentUser!.id);
    const isInitiator = isLoggedIn && progress.initiatedBy === currentUser!.id;
    
    // For actions that require having "sent" the email:
    // Only the user who initiated or marked as sent should be able to modify post-sent statuses
    const canModifyPostSentStatus = isLoggedIn && (
        isInitiator || 
        // If we had a "sentBy" field, we'd check that here
        (progress.emailStatus !== EmailStatus.NOT_SENT && isContributor)
    );

    // Basic permissions
    const canMarkAsSent = isLoggedIn && isContributor && progress.emailStatus === EmailStatus.NOT_SENT;
    const canModifyRepo = isLoggedIn && isInitiator; // Only initiator can modify repo
    const canUpdateProgress = canModifyPostSentStatus;

    // Update local state when progress changes
    useEffect(() => {
        setGithubRepoValue(progress.githubRepoId || '');
    }, [progress.githubRepoId]);

    // Auto-update to "No Response" when cooldown expires
    useEffect(() => {
        const checkAutoNoResponse = async () => {
            if (progress.emailStatus === EmailStatus.SENT && 
                progress.emailSentAt && 
                hasReachedNoResponseTime()) {
                
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

    // Cleanup debounce timer
    useEffect(() => {
        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [debounceTimer]);

    if (!progress) {
        return (
            <div className="progress-container">
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No Progress Data</h3>
                    <p>Implementation progress information is not available.</p>
                </div>
            </div>
        );
    }

    const handleEmailStatusUpdate = async (newStatus: EmailStatus) => {
        if (newStatus === EmailStatus.RESPONSE_RECEIVED) {
            setShowResponseModal(true);
            return;
        }
        
        setPendingStatus(newStatus);
        setShowConfirmModal(true);
    };

    const handleResponseTypeSelection = async (responseType: EmailStatus) => {
        setShowResponseModal(false);
        await updateProgress(responseType);
    };

    const confirmStatusUpdate = async () => {
        if (!pendingStatus) return;
        setShowConfirmModal(false);
        await updateProgress(pendingStatus);
        setPendingStatus(null);
    };

    const updateProgress = async (newStatus: EmailStatus) => {
        setIsUpdating(true);
        setError(null);

        try {
            const updatedProgress: ImplementationProgress = {
                ...progress,
                emailStatus: newStatus,
                updatedAt: new Date().toISOString()
            };
            
            await onImplementationProgressChange(updatedProgress);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update progress');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleGithubRepoUpdate = async (githubRepoId: string) => {
        setIsUpdating(true);
        setError(null);

        try {
            const cleanRepoId = cleanGithubRepoId(githubRepoId);
            
            const updatedProgress: ImplementationProgress = {
                ...progress,
                githubRepoId: cleanRepoId,
                updatedAt: new Date().toISOString()
            };
            
            await onImplementationProgressChange(updatedProgress);
            setIsEditingRepo(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update GitHub repository');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleGithubRepoInputChange = useCallback((value: string) => {
        setGithubRepoValue(value);
        
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        const newTimer = setTimeout(() => {
            if (value !== progress.githubRepoId) {
                handleGithubRepoUpdate(value);
            }
        }, 1000);
        
        setDebounceTimer(newTimer);
    }, [debounceTimer, progress.githubRepoId]);

    const getStatusIcon = (status: EmailStatus) => {
        switch (status) {
            case EmailStatus.NOT_SENT: return '📧';
            case EmailStatus.SENT: return '✉️';
            case EmailStatus.RESPONSE_RECEIVED: return '📬';
            case EmailStatus.CODE_UPLOADED: return '✅';
            case EmailStatus.CODE_NEEDS_REFACTORING: return '🔧';
            case EmailStatus.REFUSED_TO_UPLOAD: return '❌';
            case EmailStatus.NO_RESPONSE: return '📭';
            default: return '📧';
        }
    };

    const getStatusColor = (status: EmailStatus) => {
        switch (status) {
            case EmailStatus.NOT_SENT: return 'neutral';
            case EmailStatus.SENT: return 'info';
            case EmailStatus.RESPONSE_RECEIVED: return 'warning';
            case EmailStatus.CODE_UPLOADED: return 'success';
            case EmailStatus.CODE_NEEDS_REFACTORING: return 'warning';
            case EmailStatus.REFUSED_TO_UPLOAD: return 'error';
            case EmailStatus.NO_RESPONSE: return 'error';
            default: return 'neutral';
        }
    };

    const getNextAllowedStatuses = (currentStatus: EmailStatus): EmailStatus[] => {
        switch (currentStatus) {
            case EmailStatus.NOT_SENT:
                return [EmailStatus.SENT];
            case EmailStatus.SENT:
                return [EmailStatus.RESPONSE_RECEIVED];
            case EmailStatus.RESPONSE_RECEIVED:
            case EmailStatus.CODE_UPLOADED:
            case EmailStatus.CODE_NEEDS_REFACTORING:
            case EmailStatus.REFUSED_TO_UPLOAD:
            case EmailStatus.NO_RESPONSE:
                return [];
            default:
                return [];
        }
    };

    const hasReachedNoResponseTime = (): boolean => {
        if (!progress.emailSentAt) return false;
        
        const sentDate = new Date(progress.emailSentAt);
        const now = new Date();
        const fourWeeksInMs = 4 * 7 * 24 * 60 * 60 * 1000;
        
        return (now.getTime() - sentDate.getTime()) >= fourWeeksInMs;
    };

    const getTimeUntilNoResponse = (): string | null => {
        if (!progress.emailSentAt || hasReachedNoResponseTime()) return null;
        
        const sentDate = new Date(progress.emailSentAt);
        const now = new Date();
        const fourWeeksInMs = 28 * 24 * 60 * 60 * 1000;
        const timePassedMs = now.getTime() - sentDate.getTime();
        const timeRemainingMs = fourWeeksInMs - timePassedMs;
        
        if (timeRemainingMs < 60 * 60 * 1000) return null;
        
        const days = Math.floor(timeRemainingMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeRemainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        if (days > 0) {
            return `${days} day${days !== 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        
        return null;
    };

    const getStatusDescription = (status: EmailStatus): string => {
        switch (status) {
            case EmailStatus.NOT_SENT:
                return "Ready to contact the paper's authors about implementing their work";
            case EmailStatus.SENT:
                return "Email sent to authors. Waiting for their response within 4 weeks";
            case EmailStatus.RESPONSE_RECEIVED:
                return "Authors have responded! Please specify the type of response";
            case EmailStatus.CODE_UPLOADED:
                return "Authors published their working implementation";
            case EmailStatus.CODE_NEEDS_REFACTORING:
                return "Authors shared code but it needs improvement";
            case EmailStatus.REFUSED_TO_UPLOAD:
                return "Authors declined to share their implementation";
            case EmailStatus.NO_RESPONSE:
                return "No response received from authors after 4 weeks";
            default:
                return "";
        }
    };

    const getGithubUrl = (repoId: string): string => {
        if (repoId.startsWith('http://') || repoId.startsWith('https://')) {
            return repoId;
        }
        return `https://github.com/${repoId}`;
    };

    const cleanGithubRepoId = (input: string): string => {
        if (!input.includes('github.com') && input.includes('/') && !input.includes(' ')) {
            return input.trim();
        }
        
        const githubUrlPattern = /github\.com\/([^\/]+\/[^\/\?#]+)/;
        const match = input.match(githubUrlPattern);
        
        if (match) {
            return match[1];
        }
        
        return input.trim();
    };

    const formatDateDistance = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        
        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
        
        if (days > 0) {
            return `${days}d ago`;
        } else if (hours > 0) {
            return `${hours}h ago`;
        } else if (minutes > 5) {
            return `${minutes}m ago`;
        } else {
            return 'Just now';
        }
    };

    const shouldShowGithubField = () => {
        return [
            EmailStatus.CODE_UPLOADED,
            EmailStatus.CODE_NEEDS_REFACTORING,
            EmailStatus.REFUSED_TO_UPLOAD,
            EmailStatus.NO_RESPONSE
        ].includes(progress.emailStatus);
    };

    return (
        <div className="progress-container">
            {/* Header */}
            <div className="progress-header">
                <div className="header-content">
                    <h2>Implementation Progress</h2>
                    <p className="header-subtitle">Track the progress of implementing this paper's methodology</p>
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    <span className="alert-icon">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* GitHub Repository - Always at top when visible */}
            {shouldShowGithubField() && (
                <div className="section github-repository-section">
                    <div className="section-header">
                        <h3 className="section-title">🔗 Implementation Repository</h3>
                        <p className="section-subtitle">GitHub repository where the implementation is hosted</p>
                    </div>

                    <div className="repo-container">
                        {progress.githubRepoId && !isEditingRepo ? (
                            <div className="repo-display-card">
                                <div className="repo-main-content">
                                    <div className="repo-icon">
                                        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                                        </svg>
                                    </div>
                                    <div className="repo-info">
                                        <a 
                                            href={getGithubUrl(progress.githubRepoId)} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="repo-link-main"
                                        >
                                            {progress.githubRepoId}
                                        </a>
                                        <span className="repo-description">View implementation on GitHub</span>
                                    </div>
                                </div>
                                <div className="repo-actions">
                                    {canModifyRepo && (
                                        <button 
                                            className="btn-repo-edit"
                                            onClick={() => setIsEditingRepo(true)}
                                            disabled={isUpdating}
                                            title="Edit repository"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {!canModifyRepo && isLoggedIn && (
                                    <div className="repo-permission-note">
                                        Only the implementation initiator can edit the repository
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="repo-edit-form">
                                <div className="form-group">
                                    <label htmlFor="github-repo" className="form-label">
                                        GitHub Repository
                                    </label>
                                    <input
                                        id="github-repo"
                                        type="text"
                                        value={githubRepoValue}
                                        onChange={(e) => handleGithubRepoInputChange(e.target.value)}
                                        placeholder="e.g., username/repo-name or https://github.com/username/repo-name"
                                        disabled={isUpdating || !canModifyRepo}
                                        className="form-input-repo"
                                    />
                                    <div className="form-hint">
                                        Enter the GitHub repository ID (username/repo-name) or full URL
                                    </div>
                                </div>
                                
                                <div className="form-actions-repo">
                                    <button 
                                        className="btn btn-primary"
                                        onClick={() => handleGithubRepoUpdate(githubRepoValue.trim())}
                                        disabled={isUpdating || githubRepoValue.trim() === (progress.githubRepoId || '')}
                                    >
                                        {isUpdating ? 'Saving...' : 'Save'}
                                    </button>
                                    {progress.githubRepoId && (
                                        <button 
                                            className="btn btn-outline-secondary"
                                            onClick={() => {
                                                setIsEditingRepo(false);
                                                setGithubRepoValue(progress.githubRepoId || '');
                                            }}
                                            disabled={isUpdating}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                                
                                {!canModifyRepo && isLoggedIn && (
                                    <div className="permission-message">
                                        Only the implementation initiator can edit the repository URL.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Progress Overview */}
            <div className="progress-overview">
                <div className="overview-cards">
                    {/* Status Card */}
                    <div className={`status-card status-${getStatusColor(progress.emailStatus)}`}>
                        <div className="card-header">
                            <div className="status-info">
                                <span className="status-icon">{getStatusIcon(progress.emailStatus)}</span>
                                <div className="status-details">
                                    <h3 className="status-title">{progress.emailStatus}</h3>
                                    <p className="status-description">{getStatusDescription(progress.emailStatus)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Email Status Details */}
                        {progress.emailStatus === EmailStatus.SENT && (
                            <div className="email-status-details">
                                <div className="status-timeline">
                                    <div className="timeline-item completed">
                                        <div className="timeline-marker">✓</div>
                                        <div className="timeline-content">
                                            <span className="timeline-title">Email Sent</span>
                                            <span className="timeline-subtitle">
                                                {progress.emailSentAt ? formatDateDistance(progress.emailSentAt) : 'Recently'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="timeline-item pending">
                                        <div className="timeline-marker">⏳</div>
                                        <div className="timeline-content">
                                            <span className="timeline-title">Awaiting Response</span>
                                            <span className="timeline-subtitle">Authors have 4 weeks to respond</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Countdown Timer */}
                                {!hasReachedNoResponseTime() && (
                                    <div className="countdown-section">
                                        <div className="countdown-header">
                                            <span className="countdown-icon">⏱️</span>
                                            <span className="countdown-label">Auto "No Response" in:</span>
                                        </div>
                                        <div className="countdown-display">
                                            <span className="countdown-value">{getTimeUntilNoResponse()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Response Received Details */}
                        {progress.emailStatus === EmailStatus.RESPONSE_RECEIVED && (
                            <div className="email-status-details">
                                <div className="status-timeline">
                                    <div className="timeline-item completed">
                                        <div className="timeline-marker">✓</div>
                                        <div className="timeline-content">
                                            <span className="timeline-title">Email Sent</span>
                                            <span className="timeline-subtitle">
                                                {progress.emailSentAt ? formatDateDistance(progress.emailSentAt) : 'Previously'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="timeline-item completed">
                                        <div className="timeline-marker">✓</div>
                                        <div className="timeline-content">
                                            <span className="timeline-title">Authors Responded</span>
                                            <span className="timeline-subtitle">Ready for next steps</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Other Status Details */}
                        {(progress.emailStatus === EmailStatus.CODE_UPLOADED || 
                          progress.emailStatus === EmailStatus.CODE_NEEDS_REFACTORING ||
                          progress.emailStatus === EmailStatus.REFUSED_TO_UPLOAD ||
                          progress.emailStatus === EmailStatus.NO_RESPONSE) && (
                            <div className="email-status-details">
                                <div className="status-summary">
                                    <div className="summary-item">
                                        <span className="summary-label">Status:</span>
                                        <span className="summary-value">{progress.emailStatus}</span>
                                    </div>
                                    {progress.emailSentAt && (
                                        <div className="summary-item">
                                            <span className="summary-label">Email sent:</span>
                                            <span className="summary-value">{formatDateDistance(progress.emailSentAt)}</span>
                                        </div>
                                    )}
                                    <div className="summary-item">
                                        <span className="summary-label">Last updated:</span>
                                        <span className="summary-value">{formatDateDistance(progress.updatedAt)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons - Only show if user has permission */}
                        {(canMarkAsSent || canUpdateProgress) && (
                            <div className="card-actions">
                                {getNextAllowedStatuses(progress.emailStatus).map((nextStatus) => {
                                    // Check specific permissions for each action
                                    const canPerformAction = 
                                        nextStatus === EmailStatus.SENT ? canMarkAsSent : canUpdateProgress;
                                    
                                    if (!canPerformAction) return null;
                                    
                                    return (
                                        <button
                                            key={nextStatus}
                                            className="btn btn-primary action-button"
                                            onClick={() => handleEmailStatusUpdate(nextStatus)}
                                            disabled={isUpdating}
                                        >
                                            <span className="action-icon">{getStatusIcon(nextStatus)}</span>
                                            <span className="action-text">
                                                {nextStatus === EmailStatus.RESPONSE_RECEIVED ? 'Authors Responded' : `Mark as ${nextStatus}`}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        
                        {/* Show login prompt if not logged in */}
                        {!isLoggedIn && (
                            <div className="card-actions">
                                <div className="login-prompt">
                                    <p>Please log in to update implementation progress</p>
                                </div>
                            </div>
                        )}
                        
                        {/* Show contributor prompt if logged in but not a contributor */}
                        {isLoggedIn && !isContributor && (
                            <div className="card-actions">
                                <div className="contributor-prompt">
                                    <p>Only contributors can update implementation progress. Express interest in this paper to contribute.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Community Stats */}
                    <div className="stats-card">
                        <div className="card-header">
                            <h3 className="card-title">Community Interest</h3>
                        </div>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <div className="stat-icon">👥</div>
                                <div className="stat-content">
                                    <div className="stat-number">{progress.contributors.length}</div>
                                    <div className="stat-label">
                                        {progress.contributors.length === 1 ? 'Contributor' : 'Contributors'}
                                    </div>
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-icon">📅</div>
                                <div className="stat-content">
                                    <div className="stat-number">{formatDateDistance(progress.createdAt)}</div>
                                    <div className="stat-label">Since started</div>
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-icon">⚡</div>
                                <div className="stat-content">
                                    <div className="stat-number">{formatDateDistance(progress.updatedAt)}</div>
                                    <div className="stat-label">Last activity</div>
                                </div>
                            </div>
                        </div>
                        
                        {progress.contributors.length > 0 && (
                            <div className="card-actions">
                                <button 
                                    className="btn btn-secondary action-button"
                                    onClick={() => setShowContributorsModal(true)}
                                >
                                    <span className="action-icon">👥</span>
                                    <span className="action-text">View Contributors</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Response Type Modal */}
            <Modal
                isOpen={showResponseModal}
                onClose={() => setShowResponseModal(false)}
                title="What was the author's response?"
                maxWidth="600px"
            >
                <p style={{ marginBottom: '24px', color: 'var(--text-muted-color, #6c757d)' }}>
                    Please select the type of response you received from the paper's authors:
                </p>
                
                <div className="response-options">
                    <button 
                        className="response-option success"
                        onClick={() => handleResponseTypeSelection(EmailStatus.CODE_UPLOADED)}
                        disabled={isUpdating}
                    >
                        <div className="response-icon">✅</div>
                        <div className="response-content">
                            <div className="response-title">Code Uploaded</div>
                            <div className="response-description">Authors published their working implementation</div>
                        </div>
                    </button>
                    
                    <button 
                        className="response-option warning"
                        onClick={() => handleResponseTypeSelection(EmailStatus.CODE_NEEDS_REFACTORING)}
                        disabled={isUpdating}
                    >
                        <div className="response-icon">🔧</div>
                        <div className="response-content">
                            <div className="response-title">Code Needs Refactoring</div>
                            <div className="response-description">Authors shared code but it needs improvement</div>
                        </div>
                    </button>
                    
                    <button 
                        className="response-option error"
                        onClick={() => handleResponseTypeSelection(EmailStatus.REFUSED_TO_UPLOAD)}
                        disabled={isUpdating}
                    >
                        <div className="response-icon">❌</div>
                        <div className="response-content">
                            <div className="response-title">Refused to Upload</div>
                            <div className="response-description">Authors declined to share their implementation</div>
                        </div>
                    </button>
                </div>
                
                <div className="modal-actions">
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => setShowResponseModal(false)}
                        disabled={isUpdating}
                    >
                        Cancel
                    </button>
                </div>
            </Modal>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showConfirmModal && !!pendingStatus}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={confirmStatusUpdate}
                title="Confirm Status Update"
                confirmText={isUpdating ? 'Updating...' : `Confirm ${pendingStatus}`}
                cancelText="Cancel"
                confirmButtonClass="btn-primary"
                isConfirming={isUpdating}
            >
                <p>
                    Are you sure you want to mark the status as <strong>"{pendingStatus}"</strong>?
                </p>
            </ConfirmationModal>

            {/* Contributors Modal */}
            <Modal
                isOpen={showContributorsModal}
                onClose={() => setShowContributorsModal(false)}
                title="Contributors"
                maxWidth="600px"
            >
                <p style={{ marginBottom: '20px', color: 'var(--text-muted-color, #6c757d)' }}>
                    People interested in implementing this paper
                </p>
                
                <UserDisplayList
                    users={contributorUsers}
                    title="Contributors"
                    isLoading={isLoadingContributors}
                    error={contributorError}
                    emptyMessage="No contributors have expressed interest in implementing this paper yet."
                />
                
                <div className="modal-actions">
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setShowContributorsModal(false)}
                    >
                        Close
                    </button>
                </div>
            </Modal>
        </div>
    );
};
