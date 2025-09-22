import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paper } from '../../common/types/paper';
import './SidebarTabs.css';

export type SidebarTab = 'trending' | 'recent' | 'bookmarks';

interface SidebarTabsProps {
  trendingPapers?: Paper[];
  recentlyViewed?: Paper[];
  bookmarkedPapers?: Paper[];
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  isLoading?: boolean;
}

const SidebarTabs: React.FC<SidebarTabsProps> = ({
  trendingPapers = [],
  recentlyViewed = [],
  bookmarkedPapers = [],
  activeTab = 'trending',
  onTabChange,
  isLoading = false
}) => {
  const [currentTab, setCurrentTab] = useState<SidebarTab>(activeTab);

  const handleTabChange = (tab: SidebarTab) => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const getCurrentPapers = (): Paper[] => {
    switch (currentTab) {
      case 'trending':
        return trendingPapers;
      case 'recent':
        return recentlyViewed;
      case 'bookmarks':
        return bookmarkedPapers;
      default:
        return trendingPapers;
    }
  };

  const getTrendingMetric = (paper: Paper): string => {
    // For trending papers, show upvotes. For others, show appropriate metrics
    if (currentTab === 'trending' && paper.upvoteCount > 0) {
      return `▲ ${paper.upvoteCount} this week`;
    }
    if (currentTab === 'recent') {
      return 'Recently viewed';
    }
    if (currentTab === 'bookmarks') {
      return 'Upvoted';
    }
    return '';
  };

  const tabs = [
    { id: 'trending' as SidebarTab, label: 'Trending' },
    { id: 'recent' as SidebarTab, label: 'Recent' },
    { id: 'bookmarks' as SidebarTab, label: 'Upvoted' },
  ];

  const currentPapers = getCurrentPapers();

  return (
    <div className="sidebar-tabs-container">
      <div className="sidebar-tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {isLoading ? (
          <div className="sidebar-loading">
            <div className="loading-dots"></div>
            <span>Loading...</span>
          </div>
        ) : currentPapers.length === 0 ? (
          <div className="sidebar-empty">
            <p>
              {currentTab === 'trending' && 'No trending papers this week.'}
              {currentTab === 'recent' && 'No recently viewed papers.'}
              {currentTab === 'bookmarks' && 'No upvoted papers yet.'}
            </p>
          </div>
        ) : (
          <div className="sidebar-paper-list">
            {currentPapers.slice(0, 8).map((paper) => (
              <Link key={paper.id} to={`/paper/${paper.id}`} className="sidebar-paper-item">
                <div className="paper-info">
                  <h4 className="sidebar-paper-title">{paper.title}</h4>
                  <div className="sidebar-paper-authors">
                    {paper.authors && paper.authors.length > 0
                      ? `${paper.authors[0]}${paper.authors.length > 1 ? ' et al.' : ''}`
                      : 'Unknown authors'}
                  </div>
                </div>
                <div className="paper-metric">
                  {getTrendingMetric(paper)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {currentPapers.length > 8 && (
        <div className="sidebar-footer">
          <Link 
            to={`/papers${currentTab === 'trending' ? '?sort=popular' : currentTab === 'recent' ? '?recent=true' : '?bookmarked=true'}`}
            className="view-more-link"
          >
            View all {currentTab} →
          </Link>
        </div>
      )}
    </div>
  );
};

export default SidebarTabs;
