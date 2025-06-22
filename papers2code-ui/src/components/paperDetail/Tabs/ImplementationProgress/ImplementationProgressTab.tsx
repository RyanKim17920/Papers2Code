import React, { useState, useEffect, useCallback } from 'react';
import { ImplementationProgress, EmailStatus } from '../../../../common/types/implementation';
import ConfirmationModal from '../../../../common/components/ConfirmationModal';
import Modal from '../../../../common/components/Modal';
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
    const [isEditingRepo, setIsEditingRepo] = useState(false);
    const [showContributorsModal, setShowContributorsModal] = useState(false);

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

                        {/* Countdown Timer */}
                        {progress.emailStatus === EmailStatus.SENT && !hasReachedNoResponseTime() && (
                            <div className="countdown-section">
                                <div className="countdown-info">
                                    <div className="countdown-icon">⏱️</div>
                                    <div className="countdown-content">
                                        <span className="countdown-label">Auto "No Response" in:</span>
                                        <span className="countdown-value">{getTimeUntilNoResponse()}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {getNextAllowedStatuses(progress.emailStatus).length > 0 && (
                            <div className="card-actions">
                                {getNextAllowedStatuses(progress.emailStatus).map((nextStatus) => (
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
                                ))}
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

            {/* GitHub Repository */}
            {shouldShowGithubField() && (
                <div className="section">
                    <div className="section-header">
                        <h3 className="section-title">Implementation Repository</h3>
                        <p className="section-subtitle">GitHub repository where the implementation is hosted</p>
                    </div>

                    <div className="repo-card">
                        {progress.githubRepoId && !isEditingRepo ? (
                            <div className="repo-display">
                                <div className="repo-info">
                                    <div className="repo-icon">📁</div>
                                    <div className="repo-details">
                                        <a 
                                            href={getGithubUrl(progress.githubRepoId)} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="repo-link"
                                        >
                                            {progress.githubRepoId}
                                        </a>
                                        <span className="repo-hint">Click to visit repository</span>
                                    </div>
                                </div>
                                <button 
                                    className="btn btn-outline-secondary"
                                    onClick={() => setIsEditingRepo(true)}
                                    disabled={isUpdating}
                                >
                                    Edit
                                </button>
                            </div>
                        ) : (
                            <div className="repo-form">
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
                                        disabled={isUpdating}
                                        className="form-input"
                                    />
                                    <div className="form-hint">
                                        Enter the GitHub repository ID (username/repo-name) or full URL
                                    </div>
                                </div>
                                
                                {progress.githubRepoId && (
                                    <div className="form-actions">
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
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                maxWidth="500px"
            >
                <p style={{ marginBottom: '20px', color: 'var(--text-muted-color, #6c757d)' }}>
                    People interested in implementing this paper
                </p>
                
                <div className="contributors-content">
                    {progress.contributors.length > 0 ? (
                        <div className="contributors-list">
                            {progress.contributors.map((contributorId, index) => (
                                <div key={contributorId} className="contributor-item">
                                    <div className="contributor-avatar">
                                        <div className="avatar-placeholder">
                                            {(index + 1).toString()}
                                        </div>
                                    </div>
                                    <div className="contributor-info">
                                        <div className="contributor-name">Contributor {index + 1}</div>
                                        <div className="contributor-id">ID: {contributorId}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">👥</div>
                            <p>No contributors yet</p>
                        </div>
                    )}
                </div>
                
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
