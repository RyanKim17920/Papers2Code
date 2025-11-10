import React, { useState } from 'react';
import { ProgressStatus, ImplementationProgress, ProgressUpdateRequest } from '@/shared/types/implementation';
import type { UserProfile } from '@/shared/types/user';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import Modal from '@/shared/components/Modal';
import { updateImplementationProgressInApi } from '@/shared/services/api';

interface EmailStatusManagerProps {
  progress: ImplementationProgress;
  paperId: string; // Add paperId to ensure we have a valid ID
  paperStatus: string; // The paper's overall status (from paper.status field)
  onProgressChange: (updatedProgress: ImplementationProgress) => void;
  canMarkAsSent: boolean;
  canModifyPostSentStatus: boolean;
  isUpdating: boolean;
  onUpdatingChange: (isUpdating: boolean) => void;
  onError: (error: string | null) => void;
  currentUser: UserProfile | null;
  onSendEmail: () => Promise<void>; // Function to send outreach email
  isSendingEmail: boolean; // Loading state for email sending
}

export const EmailStatusManager: React.FC<EmailStatusManagerProps> = ({
  progress,
  paperId,
  paperStatus,
  onProgressChange,
  canMarkAsSent,
  canModifyPostSentStatus,
  isUpdating,
  onUpdatingChange,
  onError,
  currentUser,
  onSendEmail,
  isSendingEmail
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ProgressStatus | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);

  const handleEmailStatusUpdate = async (newStatus: ProgressStatus) => {
    if (newStatus === ProgressStatus.RESPONSE_RECEIVED) {
      setShowResponseModal(true);
      return;
    }

    setShowConfirmModal(true);
    setPendingStatus(newStatus);
  };

  const handleResponseTypeSelection = async (responseType: ProgressStatus) => {
    setShowResponseModal(false);
    
    try {
      onUpdatingChange(true);
      const updateRequest: ProgressUpdateRequest = {
        status: responseType
      };
      const updatedProgress = await updateImplementationProgressInApi(paperId, updateRequest);
      await onProgressChange(updatedProgress);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      onUpdatingChange(false);
    }
  };

  const confirmStatusUpdate = async () => {
    if (!pendingStatus) return;
    
    console.log('pendingStatus', pendingStatus);
    
    // Validate time only for NO_RESPONSE - REFUSED_TO_UPLOAD can be done anytime
    if (pendingStatus === ProgressStatus.NO_RESPONSE) {
      const hasEmailBeenSent = progress.updates.some(u => u.eventType === 'Email Sent');
      
      if (hasEmailBeenSent && progress.latestUpdate) {
        const sentDate = new Date(progress.latestUpdate);
        const now = new Date();
        const fourWeeksInMs = 4 * 7 * 24 * 60 * 60 * 1000;
        const timePassedMs = now.getTime() - sentDate.getTime();
        
        if (timePassedMs < fourWeeksInMs) {
          const daysRemaining = Math.ceil((fourWeeksInMs - timePassedMs) / (24 * 60 * 60 * 1000));
          onError(`Cannot mark as "No Response" yet. Please wait ${daysRemaining} more day${daysRemaining !== 1 ? 's' : ''}. Authors have 4 weeks to respond. If they explicitly refused, use "Refused to Upload" instead.`);
          setShowConfirmModal(false);
          setPendingStatus(null);
          return;
        }
      }
    }
    
    try {
      onUpdatingChange(true);
      const updateRequest: ProgressUpdateRequest = {
        status: pendingStatus
      };
      const updatedProgress = await updateImplementationProgressInApi(paperId, updateRequest);
      await onProgressChange(updatedProgress);
      setShowConfirmModal(false);
      setPendingStatus(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      onUpdatingChange(false);
    }
  };

  const getStatusIcon = (status: ProgressStatus) => {
    switch (status) {
      case ProgressStatus.STARTED: return '📧';
      case ProgressStatus.EMAIL_SENT: return '✉️';
      case ProgressStatus.RESPONSE_RECEIVED: return '📬';
      case ProgressStatus.CODE_UPLOADED: return '✅';
      case ProgressStatus.CODE_NEEDS_REFACTORING: return '🔧';
      case ProgressStatus.REFUSED_TO_UPLOAD: return '❌';
      case ProgressStatus.NO_RESPONSE: return '📭';
      default: return '📧';
    }
  };

  const getNextAllowedStatuses = (currentStatus: ProgressStatus): ProgressStatus[] => {
    switch (currentStatus) {
      case ProgressStatus.STARTED:
        // When status is Started and email has been sent (checked via hasEmailBeenSent in parent),
        // show "Authors Responded" and "No Response" buttons
        // When email hasn't been sent yet, the "View Author Outreach Email" button handles that
        return [ProgressStatus.RESPONSE_RECEIVED, ProgressStatus.NO_RESPONSE];
      case ProgressStatus.EMAIL_SENT:
        // When status is Email Sent, allow moving to Response Received or No Response
        return [ProgressStatus.RESPONSE_RECEIVED, ProgressStatus.NO_RESPONSE];
      case ProgressStatus.RESPONSE_RECEIVED:
      case ProgressStatus.CODE_UPLOADED:
      case ProgressStatus.CODE_NEEDS_REFACTORING:
      case ProgressStatus.REFUSED_TO_UPLOAD:
      case ProgressStatus.NO_RESPONSE:
        return [];
      default:
        return [];
    }
  };

  const formatDateDistance = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime()); // Prevent negative values
    
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days >= 1) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 5) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const getStatusDescription = (status: ProgressStatus): string => {
    // Check if email has been sent for Started status
    const hasEmailBeenSent = progress.updates.some(u => u.eventType === 'Email Sent');
    
    switch (status) {
      case ProgressStatus.STARTED:
        if (hasEmailBeenSent) {
          return "Email sent to authors. Waiting for their response within 4 weeks";
        } else {
          return "Ready to contact the paper's authors about implementing their work";
        }
      case ProgressStatus.EMAIL_SENT:
        return "Email sent to authors. Waiting for their response within 4 weeks";
      case ProgressStatus.RESPONSE_RECEIVED:
        return "Authors have responded! Please specify the type of response";
      case ProgressStatus.CODE_UPLOADED:
        return "Authors published their working implementation";
      case ProgressStatus.CODE_NEEDS_REFACTORING:
        return "Authors shared code but it needs improvement";
      case ProgressStatus.REFUSED_TO_UPLOAD:
        return "Authors declined to share their implementation";
      case ProgressStatus.NO_RESPONSE:
        return "No response received from authors after 4 weeks";
      default:
        return "";
    }
  };

  const hasReachedNoResponseTime = (): boolean => {
    if (!progress.latestUpdate) return false;
    
    const sentDate = new Date(progress.latestUpdate);
    const now = new Date();
    const fourWeeksInMs = 4 * 7 * 24 * 60 * 60 * 1000;
    
    return (now.getTime() - sentDate.getTime()) >= fourWeeksInMs;
  };

  const getTimeUntilNoResponse = (): string | null => {
    if (!progress.latestUpdate || hasReachedNoResponseTime()) return null;
    
    const sentDate = new Date(progress.latestUpdate);
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

  return (
    <div className="card-header">
      <div className="status-info">
        <span className="status-icon">{getStatusIcon(progress.status)}</span>
        <div className="status-details">
          <h3 className="status-title">{paperStatus}</h3>
          <p className="status-description">{getStatusDescription(progress.status)}</p>
        </div>
      </div>

      {/* Status Details - STARTED status, EMAIL SENT */}
      {progress.status === ProgressStatus.STARTED && progress.updates.some(u => u.eventType === 'Email Sent') && (
        <div className="email-status-details">
          <div className="status-timeline">
            <div className="timeline-item completed">
              <div className="timeline-marker">✓</div>
              <div className="timeline-content">
                <span className="timeline-title">Email Sent</span>
                <span className="timeline-subtitle">
                  {progress.latestUpdate ? formatDateDistance(progress.latestUpdate) : 'Recently'}
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
      
      {/* Status Details - STARTED status, EMAIL NOT YET SENT */}
      {progress.status === ProgressStatus.STARTED && !progress.updates.some(u => u.eventType === 'Email Sent') && (
        <div className="email-status-details">
          <div className="status-timeline">
            <div className="timeline-item completed">
              <div className="timeline-marker">✓</div>
              <div className="timeline-content">
                <span className="timeline-title">Implementation Started</span>
                <span className="timeline-subtitle">
                  {progress.createdAt ? formatDateDistance(progress.createdAt) : 'Recently'}
                </span>
              </div>
            </div>
            
            <div className="timeline-item pending">
              <div className="timeline-marker">📧</div>
              <div className="timeline-content">
                <span className="timeline-title">Ready to Contact Authors</span>
                <span className="timeline-subtitle">Send outreach email to begin collaboration</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response Received Details */}
      {progress.status === ProgressStatus.RESPONSE_RECEIVED && (
        <div className="email-status-details">
          <div className="status-timeline">
            <div className="timeline-item completed">
              <div className="timeline-marker">✓</div>
              <div className="timeline-content">
                <span className="timeline-title">Email Sent</span>
                <span className="timeline-subtitle">
                  {progress.latestUpdate ? formatDateDistance(progress.latestUpdate) : 'Previously'}
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
      {(progress.status === ProgressStatus.CODE_UPLOADED || 
        progress.status === ProgressStatus.CODE_NEEDS_REFACTORING ||
        progress.status === ProgressStatus.REFUSED_TO_UPLOAD ||
        progress.status === ProgressStatus.NO_RESPONSE) && (
          <div className="email-status-details">
            <div className="status-summary">
              <div className="summary-item">
                <span className="summary-label">Status:</span>
                <span className="summary-value">{progress.status}</span>
              </div>
              {progress.latestUpdate && (
                <div className="summary-item">
                  <span className="summary-label">Email sent:</span>
                  <span className="summary-value">{formatDateDistance(progress.latestUpdate)}</span>
                </div>
              )}
            </div>
          </div>
      )}

      {/* Send Email Button - Show when status is Started and email not sent yet */}
      {progress.status === ProgressStatus.STARTED && 
       !progress.updates.some(u => u.eventType === 'Email Sent') && 
       canMarkAsSent && (
        <div className="card-actions">
          <button
            className="btn btn-primary action-button"
            onClick={onSendEmail}
            disabled={isSendingEmail || isUpdating}
          >
            <span className="action-icon">📧</span>
            <span className="action-text">
              {isSendingEmail ? 'Sending Email...' : 'Send Author Outreach Email'}
            </span>
          </button>
        </div>
      )}

      {/* Status Change Buttons - Show when email has been sent */}
      {(canMarkAsSent || canModifyPostSentStatus) && 
       progress.updates.some(u => u.eventType === 'Email Sent') && (
        <div className="card-actions">
          {getNextAllowedStatuses(progress.status)
            .filter((nextStatus) => nextStatus !== ProgressStatus.NO_RESPONSE) // Remove NO_RESPONSE button
            .map((nextStatus) => {
              const canPerformAction = 
                nextStatus === ProgressStatus.STARTED ? canMarkAsSent : canModifyPostSentStatus;
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
                    {nextStatus === ProgressStatus.RESPONSE_RECEIVED ? 'Authors Responded' : `Mark as ${nextStatus}`}
                  </span>
                </button>
              );
            })}
        </div>
      )}
      
      {/* Show login prompt if not logged in */}
      {!currentUser && (
        <div className="card-actions">
          <div className="login-prompt">
            <p>Please log in to update implementation progress</p>
          </div>
        </div>
      )}
      
      {/* Show contributor prompt if logged in but not a contributor */}
      {currentUser && !progress.contributors.includes(currentUser.id) && (
        <div className="card-actions">
          <div className="contributor-prompt">
            <p>Only contributors can update implementation progress. Express interest in this paper to contribute.</p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setPendingStatus(null);
          }}
          onConfirm={confirmStatusUpdate}
          title={`Confirm Status Update`}
          confirmText={isUpdating ? 'Updating...' : `Confirm ${pendingStatus}`}
          cancelText="Cancel"
          confirmButtonClass="btn-primary"
          isConfirming={isUpdating}
        >
          <p>
            Are you sure you want to mark the status as <strong>"{pendingStatus}"</strong>?
          </p>
        </ConfirmationModal>
      )}

      {/* Response Type Selection Modal */}
      {showResponseModal && (
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
              onClick={() => handleResponseTypeSelection(ProgressStatus.CODE_UPLOADED)}
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
              onClick={() => handleResponseTypeSelection(ProgressStatus.CODE_NEEDS_REFACTORING)}
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
              onClick={() => handleResponseTypeSelection(ProgressStatus.REFUSED_TO_UPLOAD)}
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
      )}
    </div>
  );
};
