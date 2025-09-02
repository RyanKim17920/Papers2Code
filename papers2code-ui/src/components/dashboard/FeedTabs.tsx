import React, { useState } from 'react';
import { TrendingUp, Clock, Heart, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaperCard } from './PaperCard';
import type { Paper } from '@/types/paper';

interface FeedTabsProps {
  trendingPapers: Paper[];
  recentPapers: Paper[];
  personalizedPapers: Paper[];
  followingPapers: Paper[];
  isLoading: boolean;
  onPaperClick: (paperId: string | number) => void;
}

export const FeedTabs: React.FC<FeedTabsProps> = ({
  trendingPapers = [],
  recentPapers = [],
  personalizedPapers = [],
  followingPapers = [],
  isLoading,
  onPaperClick,
}) => {
  const [activeTab, setActiveTab] = useState('trending');
  const [visibleCount, setVisibleCount] = useState(5);

  const tabs = [
    {
      id: 'trending',
      label: 'Popular',
      icon: TrendingUp,
      papers: trendingPapers,
      description: 'Most viewed papers this week',
    },
    {
      id: 'recent',
      label: 'Newest',
      icon: Clock,
      papers: recentPapers,
      description: 'Recently published papers',
    },
    {
      id: 'personalized',
      label: 'For You',
      icon: Heart,
      papers: personalizedPapers,
      description: 'Personalized recommendations',
    },
    {
      id: 'following',
      label: 'Following',
      icon: Users,
      papers: followingPapers,
      description: 'From researchers you follow',
    },
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab);
  const currentPapers = currentTab?.papers || [];

  if (isLoading) {
    return (
      <div className="research-section">
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="research-card p-6">
                <div className="space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-full animate-pulse" />
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Research Feed</h2>
          
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 research-tab-inactive data-[state=active]:research-tab-active"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {currentTab && (
            <p className="text-sm text-muted-foreground">
              {currentTab.description}
            </p>
          )}
        </div>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-4 mt-6">
            {tab.papers.length === 0 ? (
              <div className="research-card p-8 text-center">
                <tab.icon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-foreground mb-2">No papers found</h3>
                <p className="text-sm text-muted-foreground">
                  {tab.id === 'following' 
                    ? "Follow researchers to see their latest work here"
                    : `No ${tab.label.toLowerCase()} papers available right now`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tab.papers.slice(0, visibleCount).map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    onClick={() => onPaperClick(paper.id)}
                  />
                ))}
                
                {tab.papers.length > visibleCount && (
                  <div className="text-center py-4">
                    <button 
                      onClick={() => setVisibleCount(prev => prev + 5)}
                      className="text-primary hover:text-primary/80 font-medium text-sm bg-card border border-border rounded-lg px-4 py-2 hover:bg-muted/50 transition-colors"
                    >
                      Show more papers ({tab.papers.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};