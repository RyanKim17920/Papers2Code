import React from 'react';

export const LoadingDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-[hsl(var(--gradient-start))] to-[hsl(var(--gradient-end))] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Profile */}
          <div className="lg:col-span-1">
            <div className="research-section">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded animate-pulse" />
                  <div className="h-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Center Column - Feed */}
          <div className="lg:col-span-2">
            <div className="research-section">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="h-6 bg-muted rounded w-40 animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse" />
                </div>
                
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="research-card p-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="h-5 bg-muted rounded w-3/4 animate-pulse" />
                          <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-muted rounded w-full animate-pulse" />
                          <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-5 bg-muted rounded w-16 animate-pulse" />
                          <div className="h-5 bg-muted rounded w-20 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Discovery */}
              <div className="research-section">
                <div className="space-y-4">
                  <div className="h-5 bg-muted rounded w-24 animate-pulse" />
                  <div className="h-8 bg-muted rounded animate-pulse" />
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

              {/* Contributions */}
              <div className="research-section">
                <div className="space-y-4">
                  <div className="h-5 bg-muted rounded w-32 animate-pulse" />
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="research-card p-4">
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                          <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};