import React, { useState, useCallback, useEffect } from 'react';
import { ImplementationProgress } from '../../../../common/types/implementation';

interface GitHubRepoManagerProps {
  progress: ImplementationProgress;
  onProgressChange: (updatedProgress: ImplementationProgress) => void;
  canModifyRepo: boolean;
  isUpdating: boolean;
  onUpdatingChange: (isUpdating: boolean) => void;
  onError: (error: string | null) => void;
}

export const GitHubRepoManager: React.FC<GitHubRepoManagerProps> = ({
  progress,
  onProgressChange,
  canModifyRepo,
  isUpdating,
  onUpdatingChange,
  onError
}) => {
  const [githubRepoValue, setGithubRepoValue] = useState(progress.githubRepoId || '');
  const [isEditingRepo, setIsEditingRepo] = useState(false);

  // Update local state when progress changes
  useEffect(() => {
    setGithubRepoValue(progress.githubRepoId || '');
  }, [progress.githubRepoId]);

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

  const getGithubUrl = (repoId: string): string => {
    if (repoId.startsWith('http://') || repoId.startsWith('https://')) {
      return repoId;
    }
    return `https://github.com/${repoId}`;
  };

  const handleGithubRepoUpdate = async (githubRepoId: string) => {
    onUpdatingChange(true);
    onError(null);

    try {
      const cleanRepoId = cleanGithubRepoId(githubRepoId);
      
      const updatedProgress: ImplementationProgress = {
        ...progress,
        githubRepoId: cleanRepoId,
        updatedAt: new Date().toISOString()
      };
      
      await onProgressChange(updatedProgress);
      setIsEditingRepo(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update GitHub repository');
    } finally {
      onUpdatingChange(false);
    }
  };

  const handleGithubRepoInputChange = useCallback((value: string) => {
    setGithubRepoValue(value);
  }, []);

  return (
    <div className="repo-container">
      {progress.githubRepoId && !isEditingRepo ? (
        <div className={`repo-display-card${!canModifyRepo ? ' has-warning' : ''}`}>
          <div className="repo-icon" style={{ fontSize: 28, marginRight: 0, marginTop: 2, flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </div>
          <div className={`repo-info${!canModifyRepo ? ' has-warning' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
            <a 
              href={getGithubUrl(progress.githubRepoId)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="github-repo-url repo-link-main"
              style={{ display: 'block', wordBreak: 'break-all', marginBottom: canModifyRepo ? 0 : 8, fontWeight: 500, fontSize: 16, textDecoration: 'underline', cursor: 'pointer', width: '100%' }}
            >
              {progress.githubRepoId}
            </a>
            {!canModifyRepo && (
              <div className="repo-permission-note" style={{ display: 'block', marginTop: 0 }}>
                Only the implementation initiator can edit the repository
              </div>
            )}
          </div>
          {canModifyRepo && (
            <div className="repo-actions" style={{ alignSelf: 'center', marginLeft: 12, marginRight: 4 }}>
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
          
          {!canModifyRepo && (
            <div className="permission-message">
              Only the implementation initiator can edit the repository URL.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
