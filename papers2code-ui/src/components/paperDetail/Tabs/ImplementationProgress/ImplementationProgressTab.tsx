import React, { useState, useEffect } from 'react';
import { ImplementationProgress, EmailStatus } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import { EmailStatusManager } from './EmailStatusManager';
import { GitHubRepoManager } from './GitHubRepoManager';
import { ContributorsDisplay } from './ContributorsDisplay';
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
                <div className="alert alert-error">
                    <span className="alert-icon">⚠️</span>
                    <span>{error}</span>
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
        </div>
    );
};
