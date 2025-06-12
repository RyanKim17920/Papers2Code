import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserAvatar, LoadingSpinner } from '../common/components';
import { fetchUserProfileFromApi, UserProfileResponse, voteOnPaperInApi } from '../common/services/api';
import { Paper } from '../common/types/paper';
import PaperCard from '../components/paperList/PaperCard'; // Import the actual PaperCard component
import './ProfilePage.css';

type TabType = 'overview' | 'upvoted' | 'contributing';

const ProfilePage: React.FC = () => {
  const { github_username } = useParams<{ github_username: string }>();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to update a paper in the profile data
  const updatePaperInProfileData = (updatedPaper: Paper) => {
    if (!profileData) return;
    
    setProfileData(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        upvotedPapers: prev.upvotedPapers.map(paper => 
          paper.id === updatedPaper.id ? updatedPaper : paper
        ),
        contributedPapers: prev.contributedPapers.map(paper => 
          paper.id === updatedPaper.id ? updatedPaper : paper
        )
      };
    });
  };

  // Vote handler for paper cards
  const handleVote = async (paperId: string, voteType: 'up' | 'none') => {
    try {
      const updatedPaper = await voteOnPaperInApi(paperId, voteType);
      updatePaperInProfileData(updatedPaper);
    } catch (error) {
      console.error('Failed to vote on paper:', error);
      // Optionally show an error message to the user
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!github_username) {
        setError('No username provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchUserProfileFromApi(github_username);
        
        if (data) {
          setProfileData(data);
        } else {
          setError('User not found');
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [github_username]);

  if (isLoading) {
    return (
      <div className="profile-container">
        <div className="profile-page-loading">
          <LoadingSpinner />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="profile-page-error">
          <h1>Profile Not Found</h1>
          <p>{error}</p>
          <Link to="/papers" className="back-link">← Back to Papers</Link>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="profile-container">
        <div className="profile-page-error">
          <h1>Profile Not Found</h1>
          <p>The user profile you're looking for doesn't exist.</p>
          <Link to="/papers" className="back-link">← Back to Papers</Link>
        </div>
      </div>
    );
  }

  const { userDetails, upvotedPapers, contributedPapers } = profileData;
  console.log('profileData:', profileData);
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="overview-content">
            <div className="recent-activity">
              <h3>Bio</h3>
              <div className="profile-bio">
                  {userDetails.bio ? (
                    <p>{userDetails.bio}</p>
                  ) : (
                    <p className="no-bio">This user hasn't added a bio yet.</p>
                  )}
                </div>
              <h3>Recent Activity</h3>
              <div className="activity-grid">
                <div className="activity-section">
                  <h4>Recent Upvotes</h4>
                  {upvotedPapers.slice(0, 3).map(paper => (
                    <div key={paper.id} className="mini-paper-item">
                      <Link to={`/paper/${paper.id}`} className="paper-title">{paper.title}</Link>
                      <span className={`mini-status status-${paper.status.toLowerCase().replace(' ', '-')}`}>
                        {paper.status}
                      </span>
                    </div>
                  ))}
                  {upvotedPapers.length === 0 && (
                    <p className="no-activity">No papers upvoted yet</p>
                  )}
                </div>
                
                <div className="activity-section">
                  <h4>Active Contributions</h4>
                  {contributedPapers.slice(0, 3).map(paper => (
                    <div key={paper.id} className="mini-paper-item">
                      <Link to={`/paper/${paper.id}`} className="paper-title">{paper.title}</Link>
                      <span className={`mini-status status-${paper.status.toLowerCase().replace(' ', '-')}`}>
                        {paper.status}
                      </span>
                    </div>
                  ))}
                  {contributedPapers.length === 0 && (
                    <p className="no-activity">No active contributions yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'upvoted':
        return (
          <div className="tab-content">
            <div className="content-header">
              <h2>Upvoted Papers ({upvotedPapers.length})</h2>
            </div>
            {upvotedPapers.length > 0 ? (
              <div className="papers-grid">
                {upvotedPapers.map(paper => (
                  <PaperCard
                    key={paper.id} // Ensure key is present
                    paper={paper}
                    onVote={handleVote}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No papers upvoted yet</h3>
                <p>Upvoted papers will appear here</p>
                <Link to="/papers" className="cta-button">Browse Papers</Link>
              </div>
            )}
          </div>
        );
        
      case 'contributing':
        return (
          <div className="tab-content">
            <div className="content-header">
              <h2>Contributing To ({contributedPapers.length})</h2>
            </div>
            {contributedPapers.length > 0 ? (
              <div className="papers-grid">
                {contributedPapers.map(paper => (
                  <PaperCard
                    key={paper.id} // Ensure key is present
                    paper={paper}
                    onVote={handleVote}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🚀</div>
                <h3>No active contributions</h3>
                <p>Projects you're contributing to will appear here</p>
                <Link to="/papers" className="cta-button">Find Projects</Link>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  console.log('Profile data:', profileData);
  return (
    <div className="profile-container">
      <div className="profile-page">
        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="profile-info">
              <UserAvatar 
                avatarUrl={userDetails.avatarUrl}
                username={userDetails.username}
                className="profile-avatar"
              />
              <div className="profile-details">
                <h1 className="profile-name">{userDetails.name || userDetails.username}</h1>
                <p className="profile-username">@{userDetails.username}</p>
                
                <div className="profile-badges">
                  {userDetails.isOwner && (
                    <span className="badge owner-badge">Owner</span>
                  )}
                  {userDetails.isAdmin && (
                    <span className="badge admin-badge">Admin</span>
                  )}
                </div>
                
                
                
                <div className="profile-stats">
                  <div className="stat-item">
                    <strong>{upvotedPapers.length}</strong>
                    <span>Upvotes</span>
                  </div>
                  <div className="stat-item">
                    <strong>{contributedPapers.length}</strong>
                    <span>Contributions</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          
          <main className="profile-main">
            <nav className="profile-nav">
              <button 
                className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <span className="tab-icon">📊</span>
                Overview
              </button>
              <button 
                className={`nav-tab ${activeTab === 'upvoted' ? 'active' : ''}`}
                onClick={() => setActiveTab('upvoted')}
              >
                <span className="tab-icon">👍</span>
                Upvoted
                <span className="tab-count">{upvotedPapers.length}</span>
              </button>
              <button 
                className={`nav-tab ${activeTab === 'contributing' ? 'active' : ''}`}
                onClick={() => setActiveTab('contributing')}
              >
                <span className="tab-icon">🚀</span>
                Contributing
                <span className="tab-count">{contributedPapers.length}</span>
              </button>
            </nav>
            
            <div className="profile-content">
              {renderTabContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;