import React, { useState } from 'react';
import { EmailStatus, ImplementationProgress } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import ConfirmationModal from '../../../../common/components/ConfirmationModal';
import Modal from '../../../../common/components/Modal';

interface EmailStatusManagerProps {
  progress: ImplementationProgress;
  onProgressChange: (updatedProgress: ImplementationProgress) => void;
  canMarkAsSent: boolean;
  canModifyPostSentStatus: boolean;
  isUpdating: boolean;
  onUpdatingChange: (isUpdating: boolean) => void;
  onError: (error: string | null) => void;
  currentUser: UserProfile | null;
}

export const EmailStatusManager: React.FC<EmailStatusManagerProps> = ({
  progress,
  onProgressChange,
  canMarkAsSent,
  canModifyPostSentStatus,
  isUpdating,
  onUpdatingChange,
  onError,
  currentUser
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EmailStatus | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);

  const handleEmailStatusUpdate = async (newStatus: EmailStatus) => {
    if (newStatus === EmailStatus.RESPONSE_RECEIVED) {
      setShowResponseModal(true);
      return;
    }

    setShowConfirmModal(true);
    setPendingStatus(newStatus);
  };

  const handleResponseTypeSelection = async (responseType: EmailStatus) => {
    setShowResponseModal(false);
    const updatedProgress: ImplementationProgress = {
      ...progress,
      emailStatus: responseType,
      updatedAt: new Date().toISOString()
    };
    try {
      onUpdatingChange(true);
      await onProgressChange(updatedProgress);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update email status');
    } finally {
      onUpdatingChange(false);
    }
  };

  const confirmStatusUpdate = async () => {
    if (!pendingStatus) return;
    
    console.log('pendingStatus', pendingStatus);
    const isMarkingAsSent = pendingStatus === EmailStatus.SENT;
    const updatedProgress: ImplementationProgress = {
      ...progress,
      emailStatus: pendingStatus,
      emailSentAt: isMarkingAsSent ? new Date().toISOString() : progress.emailSentAt,
      updatedAt: new Date().toISOString()
    };
    
    try {
      onUpdatingChange(true);
      await onProgressChange(updatedProgress);
      setShowConfirmModal(false);
      setPendingStatus(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update email status');
    } finally {
      onUpdatingChange(false);
    }
  };

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

  const getNextAllowedStatuses = (currentStatus: EmailStatus): EmailStatus[] => {
    switch (currentStatus) {
      case EmailStatus.NOT_SENT:
        return [EmailStatus.SENT];
      case EmailStatus.SENT:
        return [EmailStatus.RESPONSE_RECEIVED, EmailStatus.NO_RESPONSE];
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

  return (
    <div className="card-header">
      <div className="status-info">
        <span className="status-icon">{getStatusIcon(progress.emailStatus)}</span>
        <div className="status-details">
          <h3 className="status-title">{progress.emailStatus}</h3>
          <p className="status-description">{getStatusDescription(progress.emailStatus)}</p>
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
            </div>
          </div>
      )}

      {/* Action Buttons - Only show if user has permission */}
      {(canMarkAsSent || canModifyPostSentStatus) && (
        <div className="card-actions">
          {getNextAllowedStatuses(progress.emailStatus)
            .filter((nextStatus) => nextStatus !== EmailStatus.NO_RESPONSE) // Remove NO_RESPONSE button
            .map((nextStatus) => {
              const canPerformAction = 
                nextStatus === EmailStatus.SENT ? canMarkAsSent : canModifyPostSentStatus;
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
      )}
    </div>
  );
};
