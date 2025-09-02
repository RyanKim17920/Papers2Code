import React from 'react';

export const LoadingDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Left Sidebar - Header, Profile & Contributions */}
  <div className="w-72 min-h-screen column-left border-r border-border/60 flex flex-col">
          {/* Sidebar header */}
          <div className="p-4 border-b border-border/60">
            <div className="h-5 w-28 bg-muted rounded animate-pulse" />
            <div className="mt-2 h-3 w-40 bg-muted rounded animate-pulse" />
          </div>

          {/* Sidebar content */}
          <div className="flex-1 p-4 space-y-6">
            {/* Profile card skeleton */}
            <div className="p-3 rounded border border-border/50 bg-card/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                  <div className="mt-1 h-3 w-1/2 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-7 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </div>

            {/* My Papers header */}
            <div>
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-2 rounded border border-border/30 bg-card/30">
                    <div className="h-3 w-3/4 bg-muted rounded animate-pulse mb-2" />
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Center - Feed */}
          <div className="flex-1 max-w-3xl">
            <div className="p-6">
              {/* Feed header */}
              <div className="mb-2">
                <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              </div>
              {/* Tabs row under title */}
              <div className="flex space-x-1 bg-muted/30 p-1 rounded-lg mb-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-7 w-20 bg-muted rounded animate-pulse" />
                ))}
              </div>

              {/* Feed cards */}
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 rounded-lg border border-border/50 bg-card/50 min-h-[140px]">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse mb-3" />
                    <div className="space-y-2 mb-3">
                      <div className="h-3 w-full bg-muted rounded animate-pulse" />
                      <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/20">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="h-7 w-14 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Updates */}
          <div className="w-80 min-h-screen column-right border-l border-border/60">
            <div className="p-6">
              {/* Updates header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-3 w-12 bg-muted rounded animate-pulse" />
              </div>

              {/* Updates list */}
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-3 rounded border border-border/40 bg-card/40">
                    <div className="h-3 w-3/4 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-2 w-1/2 bg-muted rounded animate-pulse mb-1" />
                    <div className="h-2 w-16 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};