import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Megaphone } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { ModernUserProfile } from '@/features/dashboard/ModernUserProfile';
import { ModernFeedTabs } from '@/features/dashboard/ModernFeedTabs';
import { ModernSidebarTabs } from '@/features/dashboard/ModernSidebarTabs';
import { SiteUpdates } from '@/features/dashboard/SiteUpdates';
import { LoadingDashboard } from '@/features/dashboard/LoadingDashboard';
import type { UserProfile } from '@/shared/types/user';
import type { DashboardData } from '@/shared/services/api';
import { 
  fetchDashboardDataFromApi, 
  AuthenticationError,
  voteOnPaperInApi,
} from '@/shared/services/api';
import {
  checkCurrentUser,
  logoutUser,
} from '@/shared/services/auth';
import { cn } from '@/shared/utils/utils';
import ErrorPage from '@/features/auth/ErrorPage';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatesCollapsed, setIsUpdatesCollapsed] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [dashboardData, user] = await Promise.all([
          fetchDashboardDataFromApi(),
          checkCurrentUser(),
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

  const handleVote = async (paperId: string, voteType: 'up' | 'none') => {
    try {
      // Call the actual API to vote on the paper
      const updatedPaper = await voteOnPaperInApi(paperId, voteType);
      
      // Update the local state with the response from the API
      if (data) {
        const updatePaperVote = (papers: any[]) => 
          papers.map(paper => {
            if (paper.id === paperId) {
              return {
                ...paper,
                currentUserVote: updatedPaper.currentUserVote,
                upvoteCount: updatedPaper.upvoteCount
              };
            }
            return paper;
          });

        setData({
          ...data,
          trendingPapers: updatePaperVote(data.trendingPapers),
          myContributions: updatePaperVote(data.myContributions),
          recentlyViewed: updatePaperVote(data.recentlyViewed),
          personalizedPapers: data.personalizedPapers ? updatePaperVote(data.personalizedPapers) : undefined,
          followingPapers: data.followingPapers ? updatePaperVote(data.followingPapers) : undefined,
          bookmarkedPapers: data.bookmarkedPapers ? updatePaperVote(data.bookmarkedPapers) : undefined,
        });
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      throw error;
    }
  };

  const handleNavigateToPaper = (paperId: string | number) => {
    navigate(`/paper/${paperId}`);
  };

  const handleViewAllContributions = () => {
    navigate('/papers?user=me');
  };

  const handleNewContribution = () => {
    navigate('/papers');
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      // Note: CSRF token is stored in-memory and will be cleared on reload
      // Redirect to landing page after logout
      navigate('/');
      window.location.reload();
    } catch (logoutErr) {
      console.error('Logout failed:', logoutErr);
    }
  };

  if (isLoading) {
    return <LoadingDashboard />;
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
    <div className="min-h-screen bg-background">
      <div className="flex">
  {/* Left Sidebar - Navigation & Profile */}
  <div className="w-72 min-h-screen column-left border-r border-border/60 flex flex-col">
          
          <div className="flex-1 p-4">
            <ModernUserProfile
              user={currentUser}
              onLogout={handleLogout}
              onNewContribution={handleNewContribution}
            />
            
            <div className="mt-6">
              <ModernSidebarTabs
                trendingPapers={[]}
                recentlyViewed={data?.recentlyViewed || []}
                isLoading={false}
                onPaperClick={handleNavigateToPaper}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex relative">
          {/* Center - Feed */}
          <div
            className={cn(
              'flex-1 transition-all duration-300',
              isUpdatesCollapsed ? 'max-w-5xl xl:max-w-6xl 2xl:max-w-7xl' : 'max-w-3xl'
            )}
          >
            <div className="pt-3 pb-6 px-4 lg:px-6">
              <ModernFeedTabs
                trendingPapers={data?.trendingPapers || []}
                recentPapers={data?.trendingPapers || []}
                myPapers={data?.myContributions || []}
        bookmarkedPapers={data?.bookmarkedPapers || []}
                isLoading={false}
                onPaperClick={handleNavigateToPaper}
                onVote={handleVote}
                denseLayout={isUpdatesCollapsed}
              />
            </div>
          </div>

          {/* Right Sidebar - Updates / News */}
          {!isUpdatesCollapsed ? (
            <div className="w-80 min-h-screen column-right border-l border-border/60">
              <div className="pt-3 pb-6 px-4">
                <SiteUpdates
                  collapsed={isUpdatesCollapsed}
                  onCollapsedChange={setIsUpdatesCollapsed}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsUpdatesCollapsed(false)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border/60 bg-card/80 backdrop-blur-sm px-3 py-2 rounded-md shadow-sm transition-colors absolute top-4 right-4"
              aria-label="Show updates panel"
            >
              <Megaphone className="w-4 h-4" />
              Show updates
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;