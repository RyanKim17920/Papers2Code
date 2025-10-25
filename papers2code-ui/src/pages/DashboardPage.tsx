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
import ErrorPage from './ErrorPage';
import { getStatusColorHex } from '../common/utils/statusUtils';

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
        <div className="text-[#6b7280] text-sm italic text-center py-8">
          <p className="empty-message">{emptyMessage}</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {papers.slice(0, 5).map((paper) => (
          <Link key={paper.id} to={`/paper/${paper.id}`} className="bg-white p-3 rounded-lg border border-[#e5e7eb] cursor-pointer transition-all duration-200 hover:border-[#3b82f6] hover:shadow-md">
            <div className="text-lg font-semibold text-[#1f2937] mb-4 pb-3 border-b-2 border-[#e5e7eb]">
              <h4 className="sidebar-paper-title">{paper.title}</h4>
              {showStatus && (
                <span 
                  className="sidebar-status-badge"
                  style={{ backgroundColor: getStatusColorHex(paper.status) }}
                >
                  {paper.status}
                </span>
              )}
            </div>
            {paper.authors && paper.authors.length > 0 && (
              <p className="text-xs text-[#6b7280] mt-2 truncate">
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
      <ErrorPage
        title="Dashboard Error"
        message={error}
        showBackButton={false}
        showHomeButton={true}
        showBrowsePapersButton={true}
        showRefreshButton={true}
      />
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-8 bg-[#F6F8FA] min-h-[calc(100vh-80px)] font-[Source_Sans_Pro,Open_Sans,Lato,-apple-system,BlinkMacSystemFont,Segoe_UI,system-ui,sans-serif] relative z-[1]">
      <div className="grid grid-cols-[20%_55%_25%] gap-6 items-start min-h-[calc(100vh-200px)]">
        {/* Left Sidebar - Compact Profile & Contributions */}
        <aside className="flex flex-col gap-6 bg-[#f0f3f6] p-6 border-r border-[#d0d7de] min-h-[calc(100vh-200px)]">
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
        <main className="flex flex-col gap-0 bg-white border border-[#d0d7de] rounded-lg shadow-sm overflow-hidden">
          <FeedTabs
            trendingPapers={data?.trendingPapers || []}
            recentPapers={data?.trendingPapers || []} // Using trending as placeholder for recent
            personalizedPapers={data?.trendingPapers || []} // Using trending as placeholder for personalized
            followingPapers={[]} // Placeholder for following feature
            onPaperClick={(paper) => console.log('Paper clicked:', paper)}
            isLoading={isLoading}
          />
        </main>

        {/* Right Sidebar - Discovery Tabs */}
        <aside className="flex flex-col gap-6 bg-[#f0f3f6] p-6 border-l border-[#d0d7de] min-h-[calc(100vh-200px)]">
          <SidebarTabs
            trendingPapers={data?.trendingPapers || []}
            recentlyViewed={data?.recentlyViewed || []}
            bookmarkedPapers={[]} // Placeholder for bookmarks feature
            onPaperClick={(paper) => console.log('Paper clicked:', paper)}
            isLoading={isLoading}
          />
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;