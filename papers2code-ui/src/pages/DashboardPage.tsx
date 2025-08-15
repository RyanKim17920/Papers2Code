import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Paper } from '../common/types/paper';
import { fetchDashboardDataFromApi, DashboardData, AuthenticationError } from '../common/services/api';
import { checkCurrentUser } from '../common/services/auth';
import LoadingSpinner from '../common/components/LoadingSpinner';
import CompactUserProfile from '../components/common/CompactUserProfile';
import NewContributionButton from '../components/common/NewContributionButton';
import FeedTabs from '../components/dashboard/FeedTabs';
import SidebarTabs from '../components/dashboard/SidebarTabs';
import type { UserProfile } from '../common/types/user';
import './DashboardPage.css';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Completed': 
    case 'Published': 
    case 'Official Code Posted': 
      return '#28a745'; // Green
    case 'Work in Progress': 
    case 'In Progress':
      return '#ffc107'; // Yellow  
    case 'Started': 
    case 'Submitted':
      return '#007bff'; // Blue
    case 'Not Started': 
      return '#6c757d'; // Gray
    default: 
      return '#6c757d';
  }
};

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [dashboardData, user] = await Promise.all([
          fetchDashboardDataFromApi(),
          checkCurrentUser()
        ]);
        setData(dashboardData);
        setCurrentUser(user);
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
        {/* Left Sidebar - Compact Profile & Contributions */}
        <aside className="left-sidebar">
          {currentUser && (
            <CompactUserProfile 
              user={currentUser} 
              onLogout={() => setCurrentUser(null)} 
            />
          )}
          
          <NewContributionButton />
          
          <section className="sidebar-section contributions-section">
            <div className="section-header">
              <h3>
                <span className="section-icon">🔧</span>
                My Contributions
              </h3>
              {data && data.myContributions.length > 4 && (
                <Link to="/papers?user=me" className="view-all-link">View all</Link>
              )}
            </div>
            {data && renderPaperList(data.myContributions, "Start contributing to research papers!", true)}
          </section>
        </aside>

        {/* Main Content - Feed Tabs */}
        <main className="main-content">
          <FeedTabs
            trendingPapers={data?.trendingPapers || []}
            recentPapers={data?.trendingPapers || []} // Using trending as placeholder for recent
            personalizedPapers={data?.trendingPapers || []} // Using trending as placeholder for personalized
            followingPapers={[]} // Placeholder for following feature
            isLoading={isLoading}
          />
        </main>

        {/* Right Sidebar - Discovery Tabs */}
        <aside className="right-sidebar">
          <SidebarTabs
            trendingPapers={data?.trendingPapers || []}
            recentlyViewed={data?.recentlyViewed || []}
            bookmarkedPapers={[]} // Placeholder for bookmarks feature
            isLoading={isLoading}
          />
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;