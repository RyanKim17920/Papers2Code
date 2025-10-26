import React from 'react';
import { Skeleton } from '@/shared/ui/skeleton';
import { Button } from '@/shared/ui/button';
import { Plus, LogOut, Megaphone } from 'lucide-react';

export const LoadingDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Left Sidebar - Navigation & Profile */}
        <div className="w-72 min-h-screen column-left border-r border-border/60 flex flex-col">
          <div className="flex-1 p-4">
            {/* ModernUserProfile Skeleton with real text */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1 flex-1 min-w-0">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <Button size="sm" className="w-full" disabled>
                  <Plus className="w-4 h-4 mr-2" />
                  New Paper
                </Button>
                <Button variant="outline" size="sm" className="w-full" disabled>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
            
            <div className="mt-6">
              {/* Recent Papers Skeleton with real text */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground mb-3">Recent Papers</h3>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/30 bg-card/30">
                      <Skeleton className="h-3 w-full mb-1" />
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-2 w-20" />
                        <Skeleton className="h-2 w-10" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Center - Feed */}
          <div className="flex-1 max-w-3xl">
            <div className="pt-3 pb-6 px-4">
              {/* ModernFeedTabs Skeleton with real text */}
              <div>
                <div className="mb-2">
                  <h2 className="text-xl font-semibold text-foreground">Feed</h2>
                </div>
                <div className="flex space-x-1 bg-muted/30 p-1 rounded-lg mb-4 w-full">
                  <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-card text-foreground shadow-sm border border-border/30 flex-1">
                    <span className="w-3 h-3 i-lucide-file-text"></span>
                    <span>My Papers</span>
                    <Skeleton className="h-4 w-6 bg-muted/50 rounded" />
                  </div>
                  <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-muted-foreground flex-1">
                    <span className="w-3 h-3 i-lucide-trending-up"></span>
                    <span>Trending</span>
                    <Skeleton className="h-4 w-6 bg-muted/50 rounded" />
                  </div>
                  <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-muted-foreground flex-1">
                    <span className="w-3 h-3 i-lucide-thumbs-up"></span>
                    <span>Upvoted</span>
                    <Skeleton className="h-4 w-6 bg-muted/50 rounded" />
                  </div>
                </div>
                
                {/* Tabs Content */}
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border/50 bg-card/50 min-h-[150px] flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <Skeleton className="h-5 w-4/5 mb-2" />
                            <Skeleton className="h-4 w-1/2 mb-3" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-6" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-5/6" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 mt-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Updates / News */}
          <div className="w-80 min-h-screen column-right border-l border-border/60">
            <div className="pt-3 pb-6 px-4">
              {/* SiteUpdates Skeleton with real text */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-medium text-foreground">Updates</h3>
                  </div>
                  <button className="text-[11px] text-muted-foreground hover:text-foreground">
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 bg-card/50">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
