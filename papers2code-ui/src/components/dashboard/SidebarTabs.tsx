import React, { useState } from 'react';
import { TrendingUp, History, Bookmark } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaperCard } from './PaperCard';
import type { Paper } from '@/common/types/paper';

interface SidebarTabsProps {
  trendingPapers: Paper[];
  recentlyViewed: Paper[];
  bookmarkedPapers: Paper[];
  isLoading: boolean;
  onPaperClick: (paperId: string | number) => void;
}
const SidebarTabs: React.FC<SidebarTabsProps> = ({
  trendingPapers = [],
  recentlyViewed = [],
  bookmarkedPapers = [],
  isLoading,
  onPaperClick,
}) => {
  const [activeTab, setActiveTab] = useState('trending');

  const tabs = [
    {
      id: 'trending',
      label: 'Trending',
      icon: TrendingUp,
      papers: trendingPapers.slice(0, 5),
    },
    {
      id: 'recent',
      label: 'Recent',
      icon: History,
      papers: recentlyViewed.slice(0, 5),
    },
    {
      id: 'saved',
      label: 'Saved',
      icon: Bookmark,
      papers: bookmarkedPapers.slice(0, 5),
    },
  ];

  if (isLoading) {
    return (
      <div className="research-section">
        <div className="space-y-4">
          <div className="h-5 bg-muted rounded w-24 animate-pulse" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="research-card p-3">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-full animate-pulse" />
                  <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="research-section">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Discover</h3>
          
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1 text-xs research-tab-inactive data-[state=active]:research-tab-active"
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-3 mt-4">
            {tab.papers.length === 0 ? (
              <div className="text-center py-6">
                <tab.icon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">
                  {tab.id === 'saved' 
                    ? "Bookmark papers to see them here"
                    : `No ${tab.label.toLowerCase()} papers`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tab.papers.map((paper) => (
                  <div key={paper.id} className="overflow-hidden">
                    <PaperCard
                      paper={paper}
                      onClick={() => onPaperClick(paper.id)}
                      compact={true}
                    />
                  </div>
                ))}
                
                {(tab.id === 'trending' && trendingPapers.length > 5) ||
                 (tab.id === 'recent' && recentlyViewed.length > 5) ||
                 (tab.id === 'saved' && bookmarkedPapers.length > 5) ? (
                  <div className="text-center pt-2">
                    <button className="text-primary hover:text-primary/80 font-medium text-xs">
                      View all
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SidebarTabs;