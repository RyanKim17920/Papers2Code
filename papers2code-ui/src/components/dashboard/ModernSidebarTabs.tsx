import React, { useState } from 'react';
import { TrendingUp, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Paper } from '@/types/paper';

interface ModernSidebarTabsProps {
  trendingPapers: Paper[];
  recentlyViewed: Paper[];
  isLoading: boolean;
  onPaperClick: (paperId: string | number) => void;
}

const CompactPaperCard: React.FC<{ paper: Paper; onClick: () => void }> = ({ paper, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="group p-3 bg-card/40 border border-border/30 rounded-lg cursor-pointer hover:bg-card/60 hover:border-border/60 transition-all duration-200"
    >
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {paper.title}
        </h4>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="truncate max-w-[100px]">
              {paper.authors[0]}{paper.authors.length > 1 && ` +${paper.authors.length - 1}`}
            </span>
          </div>
          
          {paper.upvoteCount > 0 && (
            <div className="flex items-center gap-1 text-primary">
              <TrendingUp className="w-3 h-3" />
              <span className="font-medium">{paper.upvoteCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge 
            className={`text-xs px-1.5 py-0.5 ${
              paper.status === 'Published' 
                ? 'bg-green-100 text-green-700 border-green-200' 
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {paper.status}
          </Badge>
          
          <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full"></div>
          
          <span className="text-xs text-muted-foreground">
            {new Date(paper.publicationDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export const ModernSidebarTabs: React.FC<ModernSidebarTabsProps> = ({
  trendingPapers,
  recentlyViewed,
  isLoading,
  onPaperClick,
}) => {
  const [activeTab, setActiveTab] = useState('trending');

  const tabs = [
    { id: 'trending', label: 'Trending', papers: trendingPapers.slice(0, 8), icon: TrendingUp },
    { id: 'recent', label: 'Recent', papers: recentlyViewed.slice(0, 8), icon: History },
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Discovery</h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse p-2 rounded border border-border/50 bg-card/50">
              <div className="h-3 bg-muted rounded w-full mb-1" />
              <div className="h-2 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">Discovery</h3>
      
      {/* Tab Navigation */}
      <div className="flex flex-col space-y-1 mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors text-left ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </div>
              <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                {tab.papers.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {(activeTabData?.papers || []).length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border/50 rounded-lg bg-muted/20">
            <p className="text-xs text-muted-foreground">
              No {activeTabData?.label.toLowerCase()} papers yet
            </p>
          </div>
        ) : (
          (activeTabData?.papers || []).map((paper) => (
            <div
              key={paper.id}
              onClick={() => onPaperClick(paper.id)}
              className="p-3 rounded border border-border/30 bg-card/30 cursor-pointer transition-colors hover-raise"
            >
              <h4 className="font-medium text-xs text-foreground line-clamp-2 leading-relaxed mb-1">
                {paper.title}
              </h4>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {new Date(paper.publicationDate).toLocaleDateString()}
                </span>
                
                {paper.upvoteCount > 0 && (
                  <span className="flex items-center bg-muted/50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {paper.upvoteCount}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};