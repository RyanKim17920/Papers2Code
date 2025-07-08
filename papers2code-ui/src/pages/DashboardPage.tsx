import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper } from '../common/types/paper';
import { fetchDashboardDataFromApi, DashboardData, AuthenticationError } from '../common/services/api';
import PaperCard from '../components/paperList/PaperCard';
import LoadingSpinner from '../common/components/LoadingSpinner';
import './DashboardPage.css';

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
          // Redirect to login or show login prompt
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
    // For now, just a placeholder - voting functionality can be implemented later
    console.log(`Vote ${voteType} for paper ${paperId}`);
  };

  const renderPaperList = (papers: Paper[], emptyMessage: string) => {
    if (papers.length === 0) {
      return <p className="empty-message">{emptyMessage}</p>;
    }
    return (
      <div className="paper-grid">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} onVote={handleVote} />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="dashboard-container">
      <h1>Your Dashboard</h1>
      
      <section className="dashboard-section">
        <h2>🔥 Trending Papers (Last 7 Days)</h2>
        {data && renderPaperList(data.trendingPapers, 'No trending papers at the moment.')}
      </section>

      <section className="dashboard-section">
        <h2>🚀 My Contributions</h2>
        {data && renderPaperList(data.myContributions, "You haven't contributed to any papers yet.")}
      </section>

      <section className="dashboard-section">
        <h2>👀 Recently Viewed</h2>
        {data && renderPaperList(data.recentlyViewed, 'You have no recently viewed papers.')}
      </section>
    </div>
  );
};

export default DashboardPage; 