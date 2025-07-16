import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Paper } from '../common/types/paper';
import { fetchDashboardDataFromApi, DashboardData, AuthenticationError } from '../common/services/api';
import LoadingSpinner from '../common/components/LoadingSpinner';
import './DashboardPage.css';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Completed': return 'var(--success-color)';
    case 'Work in Progress': return 'var(--warning-color)';
    case 'Started': return 'var(--info-color)';
    case 'Not Started': return 'var(--text-muted-color)';
    case 'Official Code Posted': return 'var(--success-color)';
    default: return 'var(--text-muted-color)';
  }
};

const SearchBar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/papers?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/papers');
    }
  };

  return (
    <form onSubmit={handleSearch} className="search-bar">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search papers, authors, conferences..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="search-button">
          Search
        </button>
      </div>
    </form>
  );
};

const PaperCard: React.FC<{ paper: Paper; showStatus?: boolean; compact?: boolean }> = ({ 
  paper, 
  showStatus = false,
  compact = false
}) => (
  <div className={`paper-card ${compact ? 'paper-card-compact' : ''}`}>
    <Link to={`/paper/${paper.id}`} className="paper-card-link">
      <div className="paper-card-header">
        <h3 className="paper-card-title">{paper.title}</h3>
        {showStatus && (
          <span 
            className="paper-status-badge"
            style={{ backgroundColor: getStatusColor(paper.status) }}
          >
            {paper.status}
          </span>
        )}
      </div>
      
      <div className="paper-card-meta">
        {paper.authors && paper.authors.length > 0 && (
          <span className="paper-authors">
            {paper.authors.slice(0, compact ? 2 : 3).join(', ')}
            {paper.authors.length > (compact ? 2 : 3) && ` +${paper.authors.length - (compact ? 2 : 3)} more`}
          </span>
        )}
        
        <div className="paper-card-stats">
          {paper.upvoteCount > 0 && (
            <span className="paper-stat">
              <span className="stat-icon">👍</span>
              {paper.upvoteCount}
            </span>
          )}
          
          {paper.proceeding && (
            <span className="paper-venue">{paper.proceeding}</span>
          )}
        </div>
      </div>
    </Link>
  </div>
);

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="user-profile">
      <div className="profile-header">
        <div className="profile-avatar">
          <img 
            src="https://avatars.githubusercontent.com/u/17371329" 
            alt="Profile" 
            className="avatar-image"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="avatar-placeholder hidden">
            R
          </div>
        </div>
        <div className="profile-info">
          <h3 className="profile-name">RyanKim17920</h3>
        </div>
        <div className="profile-actions">
          <button 
            className="profile-btn profile-btn-primary"
            onClick={() => navigate('/profile')}
          >
            Profile
          </button>
          <button 
            className="profile-btn profile-btn-secondary"
            onClick={() => navigate('/settings')}
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchDashboardDataFromApi();
        setData(data);
        setError(null);
      } catch (err) {
        if (err instanceof AuthenticationError) {
          setError('Please log in to view your dashboard.');
          setTimeout(() => {
            navigate('/papers');
          }, 2000);
        } else {
          setError('Failed to load dashboard data. Please try refreshing the page.');
        }
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const renderPaperGrid = (papers: Paper[], emptyMessage: string, showStatus = false, compact = false) => {
    if (papers.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p className="empty-message">{emptyMessage}</p>
        </div>
      );
    }
    
    const maxPapers = compact ? 8 : 6;
    return (
      <div className={`paper-grid ${compact ? 'paper-grid-compact' : ''}`}>
        {papers.slice(0, maxPapers).map((paper) => (
          <PaperCard key={paper.id} paper={paper} showStatus={showStatus} compact={compact} />
        ))}
      </div>
    );
  };

  const renderPaperList = (papers: Paper[], emptyMessage: string, showStatus = false) => {
    if (papers.length === 0) {
      return (
        <div className="sidebar-empty">
          <p className="empty-message">{emptyMessage}</p>
        </div>
      );
    }
    
    return (
      <div className="sidebar-paper-list">
        {papers.slice(0, 5).map((paper) => (
          <Link key={paper.id} to={`/paper/${paper.id}`} className="sidebar-paper-item">
            <div className="sidebar-paper-header">
              <h4 className="sidebar-paper-title">{paper.title}</h4>
              {showStatus && (
                <span 
                  className="sidebar-status-badge"
                  style={{ backgroundColor: getStatusColor(paper.status) }}
                >
                  {paper.status}
                </span>
              )}
            </div>
            {paper.authors && paper.authors.length > 0 && (
              <p className="sidebar-paper-authors">
                {paper.authors.slice(0, 2).join(', ')}
                {paper.authors.length > 2 && '...'}
              </p>
            )}
          </Link>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-layout">
        {/* Left Sidebar - User Profile & Contributions */}
        <aside className="left-sidebar">
          <UserProfile />
          
          <section className="sidebar-section contributions-section">
            <div className="section-header">
              <h3>
                <span className="section-icon">🔧</span>
                My Contributions
              </h3>
              {data && data.myContributions.length > 4 && (
                <Link to="/papers?user=me" className="view-all-link">View all →</Link>
              )}
            </div>
            {data && renderPaperList(data.myContributions, "Start contributing to research papers!", true)}
          </section>
        </aside>

        {/* Main Content - Welcome, Search, Feed */}
        <main className="main-content">
          <header className="main-header">
            <h1 className="welcome-title">Welcome back!</h1>
            <SearchBar />
          </header>
          
          <section className="feed-section popular-papers-section">
            <div className="section-header">
              <h2>
                <span className="section-icon">🔥</span>
                Popular Papers
              </h2>
              <Link to="/papers" className="view-all-link">View all →</Link>
            </div>
            {data && renderPaperGrid(data.trendingPapers, 'No trending papers at the moment.', false, false)}
          </section>
        </main>

        {/* Right Sidebar - Recently Viewed */}
        <aside className="right-sidebar">
          <section className="sidebar-section recently-viewed-section">
            <div className="section-header">
              <h3>
                <span className="section-icon">👀</span>
                Recently Viewed
              </h3>
            </div>
            {data && renderPaperList(data.recentlyViewed, "Browse papers to see your recent activity here.", false)}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;