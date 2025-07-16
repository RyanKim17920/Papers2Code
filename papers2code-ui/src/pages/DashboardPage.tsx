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

const PaperCard: React.FC<{ paper: Paper; showStatus?: boolean; showMeta?: boolean }> = ({ 
  paper, 
  showStatus = false, 
  showMeta = true 
}) => (
  <div className="paper-card">
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
      
      {showMeta && (
        <div className="paper-card-meta">
          {paper.authors && paper.authors.length > 0 && (
            <span className="paper-authors">
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
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
      )}
    </Link>
  </div>
);

const QuickStats: React.FC<{ data: DashboardData }> = ({ data }) => {
  const totalContributions = data.myContributions.length;
  const totalViewed = data.recentlyViewed.length;
  const completedContributions = data.myContributions.filter(p => p.status === 'Completed').length;
  
  return (
    <div className="quick-stats">
      <div className="stat-item">
        <span className="stat-number">{totalContributions}</span>
        <span className="stat-label">Contributions</span>
      </div>
      <div className="stat-item">
        <span className="stat-number">{completedContributions}</span>
        <span className="stat-label">Completed</span>
      </div>
      <div className="stat-item">
        <span className="stat-number">{totalViewed}</span>
        <span className="stat-label">Recently Viewed</span>
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

  const renderPaperSection = (papers: Paper[], emptyMessage: string, showStatus = false) => {
    if (papers.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p className="empty-message">{emptyMessage}</p>
        </div>
      );
    }
    
    return (
      <div className="paper-grid">
        {papers.slice(0, 12).map((paper) => (
          <PaperCard key={paper.id} paper={paper} showStatus={showStatus} />
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
      <header className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome back!</h1>
          <p>Here's what's happening with your research contributions</p>
        </div>
        
        {data && <QuickStats data={data} />}
      </header>
      
      <div className="dashboard-content">
        <div className="dashboard-main">
          <section className="dashboard-section">
            <div className="section-header">
              <h2>
                <span className="section-icon">🔥</span>
                Trending Papers
              </h2>
              <span className="section-subtitle">Popular in the last 7 days</span>
            </div>
            {data && renderPaperSection(data.trendingPapers, 'No trending papers at the moment.')}
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <h2>
                <span className="section-icon">🚀</span>
                My Contributions
              </h2>
              <span className="section-subtitle">Papers you're working on</span>
            </div>
            {data && renderPaperSection(data.myContributions, "You haven't contributed to any papers yet.", true)}
          </section>
        </div>

        <aside className="dashboard-sidebar">
          <section className="sidebar-section">
            <div className="section-header">
              <h3>
                <span className="section-icon">👀</span>
                Recently Viewed
              </h3>
            </div>
            
            {data && data.recentlyViewed.length === 0 ? (
              <div className="sidebar-empty">
                <p>No recently viewed papers</p>
              </div>
            ) : (
              <div className="sidebar-paper-list">
                {data && data.recentlyViewed.slice(0, 8).map((paper) => (
                  <Link key={paper.id} to={`/paper/${paper.id}`} className="sidebar-paper-item">
                    <h4 className="sidebar-paper-title">{paper.title}</h4>
                    {paper.authors && paper.authors.length > 0 && (
                      <p className="sidebar-paper-authors">
                        {paper.authors.slice(0, 2).join(', ')}
                        {paper.authors.length > 2 && '...'}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="sidebar-section">
            <div className="section-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions">
              <Link to="/papers" className="action-button primary">
                <span>🔍</span>
                Browse Papers
              </Link>
              <Link to="/papers?status=Not%20Started" className="action-button secondary">
                <span>✨</span>
                Find New Projects
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage; 