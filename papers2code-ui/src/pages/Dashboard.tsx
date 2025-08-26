import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserProfileCard } from '@/components/dashboard-new/UserProfileCard';
import { FeedTabs } from '@/components/dashboard-new/FeedTabs';
import { SidebarTabs } from '@/components/dashboard-new/SidebarTabs';
import { ContributionsList } from '@/components/dashboard-new/ContributionsList';
import { LoadingDashboard } from '@/components/dashboard-new/LoadingDashboard';
import type { UserProfile } from '@/common/types/user';
import type { DashboardData } from '@/common/types/paper'; // no dashboard data so will need to implement that, mayb elook over dashboard page? 
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
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--gradient-start))] to-[hsl(var(--gradient-end))] p-6">
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
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--gradient-start))] to-[hsl(var(--gradient-end))] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Research Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {currentUser?.username || 'Researcher'}
          </p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Profile & Contributions */}
          <div className="lg:col-span-1 space-y-6">
            <UserProfileCard
              user={currentUser}
              onLogout={handleLogout}
              onNewContribution={handleNewContribution}
            />
            
            <ContributionsList
              contributions={data?.myContributions || []}
              isLoading={false}
              onPaperClick={handleNavigateToPaper}
              onViewAll={handleViewAllContributions}
              onNewContribution={handleNewContribution}
            />
          </div>

          {/* Center Column - Feed */}
          <div className="lg:col-span-2">
            <FeedTabs
              trendingPapers={data?.trendingPapers || []}
              recentPapers={data?.trendingPapers || []} // Using trending as placeholder
              personalizedPapers={data?.personalizedPapers || data?.trendingPapers || []}
              followingPapers={data?.followingPapers || []}
              isLoading={false}
              onPaperClick={handleNavigateToPaper}
            />
          </div>

          {/* Right Column - Discovery Sidebar */}
          <div className="lg:col-span-1">
            <SidebarTabs
              trendingPapers={data?.trendingPapers || []}
              recentlyViewed={data?.recentlyViewed || []}
              bookmarkedPapers={[]} // Placeholder until bookmarks implemented
              isLoading={false}
              onPaperClick={handleNavigateToPaper}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;