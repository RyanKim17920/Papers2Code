import React, { useEffect } from 'react';
import { ImplementationProgress, EmailStatus } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import { EmailStatusManager } from './EmailStatusManager';
import { GitHubRepoManager } from './GitHubRepoManager';
import { ContributorsDisplay } from './ContributorsDisplay';
import Modal from '../../../../common/components/Modal';
import { useAuthorOutreachEmail } from '../../../../common/hooks/useAuthorOutreachEmail';
import './ImplementationProgressTab.css';

interface ImplementationProgressProps {
    progress: ImplementationProgress;
    paperId: string;
    currentUser: UserProfile | null;
    onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
}

export const ImplementationProgressTab: React.FC<ImplementationProgressProps> = ({
    progress,
    paperId,
    currentUser,
    onImplementationProgressChange
}) => {
    const { emailContent, fetchEmailContent, isFetchingEmail, emailError, clearEmailContent } = useAuthorOutreachEmail(paperId);
 
    // Permission helpers
    const isLoggedIn = !!currentUser;
    const isContributor = isLoggedIn && progress.contributors.includes(currentUser!.id);
    const isInitiator = isLoggedIn && progress.initiatedBy === currentUser!.id;
    
    // For actions that require having "sent" the email:
    const canModifyPostSentStatus = isLoggedIn && (
        isInitiator || 
        (progress.emailStatus !== EmailStatus.NOT_SENT && isContributor)
    );

    // Basic permissions
    const canMarkAsSent = isLoggedIn && isContributor && progress.emailStatus === EmailStatus.NOT_SENT;
    const canModifyRepo = isLoggedIn && isInitiator;

    // State for managing updating status and errors
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Effect to set error from hook
    useEffect(() => {
        if (emailError) {
            console.error("Email fetch error:", emailError);
        }
    }, [emailError]);

    const getStatusIcon = (status: EmailStatus): string => {
        switch (status) {
            case EmailStatus.NOT_SENT:
                return '📧';
            case EmailStatus.SENT:
                return '⏳';
            case EmailStatus.CODE_UPLOADED:
                return '✅';
            case EmailStatus.CODE_NEEDS_REFACTORING:
                return '🔄';
            case EmailStatus.REFUSED_TO_UPLOAD:
                return '❌';
            case EmailStatus.NO_RESPONSE:
                return '🔇';
            default:
                return '❓';
        }
    };
 
    // Map emailStatus to status card class
    const getStatusCardClass = (status: EmailStatus): string => {
        switch (status) {
            case EmailStatus.CODE_UPLOADED:
                return 'status-success';
            case EmailStatus.CODE_NEEDS_REFACTORING:
                return 'status-warning';
            case EmailStatus.REFUSED_TO_UPLOAD:
                return 'status-error';
            case EmailStatus.NO_RESPONSE:
                return 'status-warning';
            case EmailStatus.SENT:
                return 'status-info';
            default:
                return 'status-neutral';
        }
    };
 
    // Auto-update to "No Response" when cooldown expires
    useEffect(() => {
        const hasReachedNoResponseTime = (): boolean => {
            if (!progress.emailSentAt) return false;
            
            const sentDate = new Date(progress.emailSentAt);
            const now = new Date();
            const fourWeeksInMs = 4 * 7 * 24 * 60 * 60 * 1000; // 4 weeks in milliseconds
            
            return (now.getTime() - sentDate.getTime()) >= fourWeeksInMs;
        };

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

    const shouldShowGithubField = (): boolean => {
        return [
            EmailStatus.CODE_UPLOADED,
            EmailStatus.CODE_NEEDS_REFACTORING,
            EmailStatus.REFUSED_TO_UPLOAD,
            EmailStatus.NO_RESPONSE
        ].includes(progress.emailStatus);
    };

    return (
        <div className="implementation-progress-tab">
            {/* Header */}
            <div className="progress-header">
                <div className="header-content">
                    <h2>Implementation Progress</h2>
                    <p className="header-subtitle">Track the progress of implementing this paper's methodology</p>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-banner" style={{
                    backgroundColor: '#fee', 
                    border: '1px solid #f99', 
                    borderRadius: '4px', 
                    padding: '12px', 
                    margin: '16px 0',
                    color: '#c33'
                }}>
                    <strong>Error:</strong> {error}
                    <button 
                        onClick={() => setError(null)}
                        style={{
                            marginLeft: '8px',
                            background: 'none',
                            border: 'none',
                            color: '#c33',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="status-timeline-grid">
                {/* Left Column: Status and Actions */}
                <div className="status-column">
                    {/* GitHub Repository Section - Only show when relevant */}
                    {shouldShowGithubField() && (
                        <div className="status-card">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="card-icon">🔗</span>
                                    GitHub Repository
                                </h3>
                                <div className="card-subtitle" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ wordBreak: 'break-all' }}>
                                        {/* Show repo URL if available, else fallback */}
                                    </span>
                                    {/* Removed duplicate permission note from here */}
                                </div>
                            </div>
                            <GitHubRepoManager
                                progress={progress}
                                onProgressChange={onImplementationProgressChange}
                                canModifyRepo={canModifyRepo}
                                isUpdating={isUpdating}
                                onUpdatingChange={setIsUpdating}
                                onError={setError}
                            />
                        </div>
                    )}

                    <div className={`status-card ${getStatusCardClass(progress.emailStatus)}`}>
                        <div className="card-header">
                            <h3 className="card-title">
                                <span className="card-icon">
                                    {getStatusIcon(progress.emailStatus)}
                                </span>
                                Implementation Status
                            </h3>
                            <p className="card-subtitle">
                                Current progress and communication status
                            </p>
                        </div>

                        {/* Email Status Management */}
                        <EmailStatusManager
                            progress={progress}
                            currentUser={currentUser}
                            onProgressChange={onImplementationProgressChange}
                            canMarkAsSent={canMarkAsSent}
                            canModifyPostSentStatus={canModifyPostSentStatus}
                            isUpdating={isUpdating}
                            onUpdatingChange={setIsUpdating}
                            onError={setError}
                        />
                        {isContributor && (
                            <button 
                                className="button button-secondary" 
                                onClick={fetchEmailContent}
                                disabled={isFetchingEmail}
                            >
                                {isFetchingEmail ? 'Loading...' : 'View Author Outreach Email'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Column: Timeline and Contributors */}
                <div className="timeline-column">
                    <div className="status-card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <span className="card-icon">📊</span>
                                Progress Timeline
                            </h3>
                            <p className="card-subtitle">
                                Track key milestones in the implementation process
                            </p>
                        </div>
                        <div className="progress-timeline">
                            <div className="timeline-item">
                                <div className="timeline-status">
                                    <span className="timeline-icon">🎯</span>
                                    <span>Implementation Started</span>
                                </div>
                                <div className="timeline-date">
                                    {new Date(progress.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            {progress.emailSentAt && (
                                <div className="timeline-item">
                                    <div className="timeline-status">
                                        <span className="timeline-icon">📧</span>
                                        <span>Author Contacted</span>
                                    </div>
                                    <div className="timeline-date">
                                        {new Date(progress.emailSentAt).toLocaleDateString()}
                                    </div>
                                </div>
                            )}

                            {progress.emailStatus === EmailStatus.CODE_UPLOADED && (
                                <div className="timeline-item success">
                                    <div className="timeline-status">
                                        <span className="timeline-icon">✅</span>
                                        <span>Code Available</span>
                                    </div>
                                    <div className="timeline-date">
                                        {new Date(progress.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Contributors Display - Outside of any card */}
                    <ContributorsDisplay 
                        progress={progress}
                        currentUser={currentUser}
                    />
                </div>
            </div>

            {/* Email Content Modal */}
            <Modal isOpen={!!emailContent} onClose={clearEmailContent} title="Author Outreach Email Template">
                {emailContent && (
                    <div className="email-template-modal-content">
                        <h4>Subject:</h4>
                        <textarea 
                            className="email-subject-textarea"
                            value={emailContent.subject} 
                            readOnly 
                            rows={2}
                        />
                        <h4>Body:</h4>
                        <textarea 
                            className="email-body-textarea"
                            value={emailContent.body} 
                            readOnly 
                            rows={15}
                        />
                        <p className="copy-instruction">
                            Copy the content above and send it manually.
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
};

