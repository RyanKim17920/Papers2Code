import React, { useState } from 'react';
import { Paper } from '../../common/types/paper';
import EnhancedPaperCard from './EnhancedPaperCard';
import './FeedTabs.css';

export type FeedTab = 'for-you' | 'popular' | 'newest' | 'following';

interface FeedTabsProps {
  trendingPapers?: Paper[];
  recentPapers?: Paper[];
  personalizedPapers?: Paper[];
  followingPapers?: Paper[];
  activeTab?: FeedTab;
  onTabChange?: (tab: FeedTab) => void;
  isLoading?: boolean;
}

const FeedTabs: React.FC<FeedTabsProps> = ({
  trendingPapers = [],
  recentPapers = [],
  personalizedPapers = [],
  followingPapers = [],
  activeTab = 'for-you',
  onTabChange,
  isLoading = false
}) => {
  const [currentTab, setCurrentTab] = useState<FeedTab>(activeTab);

  const handleTabChange = (tab: FeedTab) => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const getCurrentPapers = (): Paper[] => {
    switch (currentTab) {
      case 'for-you':
        return personalizedPapers.length > 0 ? personalizedPapers : trendingPapers;
      case 'popular':
        return trendingPapers;
      case 'newest':
        return recentPapers;
      case 'following':
        return followingPapers;
      default:
        return trendingPapers;
    }
  };

  const tabs = [
    { id: 'for-you' as FeedTab, label: 'For You', icon: '🎯' },
    { id: 'popular' as FeedTab, label: 'Popular', icon: '🔥' },
    { id: 'newest' as FeedTab, label: 'Newest', icon: '⚡' },
    { id: 'following' as FeedTab, label: 'Following', icon: '👥' },
  ];

  const currentPapers = getCurrentPapers();

  return (
    <div className="feed-tabs-container">
      <div className="feed-tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`feed-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="feed-content">
        {isLoading ? (
          <div className="feed-loading">
            <div className="loading-spinner"></div>
            <p>Loading papers...</p>
          </div>
        ) : currentPapers.length === 0 ? (
          <div className="feed-empty">
            <div className="empty-icon">📄</div>
            <h3>No papers found</h3>
            <p>
              {currentTab === 'for-you' && 'Start exploring papers to get personalized recommendations.'}
              {currentTab === 'popular' && 'No trending papers at the moment.'}
              {currentTab === 'newest' && 'No new papers available.'}
              {currentTab === 'following' && 'Follow authors or topics to see their latest papers here.'}
            </p>
          </div>
        ) : (
          <div className="enhanced-paper-grid">
            {currentPapers.map((paper) => (
              <EnhancedPaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedTabs;
