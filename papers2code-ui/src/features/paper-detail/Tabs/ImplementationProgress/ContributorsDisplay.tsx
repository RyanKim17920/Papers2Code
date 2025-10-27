import React, { useState } from 'react';
import { ImplementationProgress } from '@/shared/types/implementation';
import type { UserProfile } from '@/shared/types/user';
import Modal from '@/shared/components/Modal';
import { UserDisplayList } from '../../UserDisplayList';
import { useContributorProfiles } from '@/shared/hooks/useContributorProfiles';

interface ContributorsDisplayProps {
  progress: ImplementationProgress;
  currentUser: UserProfile | null;
}

export const ContributorsDisplay: React.FC<ContributorsDisplayProps> = ({
  progress
}) => {
  const [showContributorsModal, setShowContributorsModal] = useState(false);

  // Fetch real contributor user profiles
  const { contributorUsers, isLoading: isLoadingContributors, error: contributorError } = useContributorProfiles({
    contributorIds: progress.contributors,
    enabled: true
  });

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

  return (
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
