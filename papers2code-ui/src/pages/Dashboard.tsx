import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ModernUserProfile } from '@/components/dashboard/ModernUserProfile';
import { ModernFeedTabs } from '@/components/dashboard/ModernFeedTabs';
import { ModernContributions } from '@/components/dashboard/ModernContributions';
import { SiteUpdates } from '@/components/dashboard/SiteUpdates';
import { LoadingDashboard } from '@/components/dashboard/LoadingDashboard';
import type { UserProfile } from '@/common/types/user';
import type { DashboardData } from '@/common/services/api';
import { 
  fetchDashboardDataFromApi, 
  AuthenticationError,
} from '@/common/services/api';
import {
  checkCurrentUser,
  logoutUser,
} from '@/common/services/auth';

const Dashboard: React.FC = () => {
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
      // TODO: Implement actual API call for voting
      console.log(`Voting ${voteType} on paper ${paperId}`);
      
      // For now, we'll just update the local state optimistically
      // In a real app, this would make an API call and then refresh the data
      if (data) {
        const updatePaperVote = (papers: any[]) => 
          papers.map(paper => {
            if (paper.id === paperId) {
              const currentVote = paper.currentUserVote;
              const upvoteChange = voteType === 'up' 
                ? (currentVote === 'up' ? 0 : 1)
                : (currentVote === 'up' ? -1 : 0);
              
              return {
                ...paper,
                currentUserVote: voteType === 'up' ? 'up' : null,
                upvoteCount: Math.max(0, paper.upvoteCount + upvoteChange)
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
      navigate('/');
    } catch (logoutErr) {
      console.error('Logout failed:', logoutErr);
    }
  };

  if (isLoading) {
    return <LoadingDashboard />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto pt-20">
          <Alert className="bg-card border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
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
              <ModernContributions
                contributions={data?.myContributions || []}
                isLoading={false}
                onPaperClick={handleNavigateToPaper}
                onViewAll={handleViewAllContributions}
                onNewContribution={handleNewContribution}
                onVote={handleVote}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Center - Feed */}
  <div className="flex-1 max-w-3xl">
    <div className="pt-3 pb-6 px-4">
              <ModernFeedTabs
                trendingPapers={data?.trendingPapers || []}
                recentPapers={data?.recentlyViewed || []}
                personalizedPapers={data?.personalizedPapers || data?.trendingPapers || []}
                followingPapers={data?.followingPapers || []}
        bookmarkedPapers={data?.bookmarkedPapers || []}
                isLoading={false}
                onPaperClick={handleNavigateToPaper}
                onVote={handleVote}
              />
            </div>
          </div>

      {/* Right Sidebar - Updates / News */}
          <div className="w-80 min-h-screen column-right border-l border-border/60">
            <div className="pt-3 pb-6 px-4">
        <SiteUpdates />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;