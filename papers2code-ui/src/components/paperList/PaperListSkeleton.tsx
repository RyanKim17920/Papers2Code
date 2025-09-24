import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

interface PaperListSkeletonProps {
  count?: number;
  measuredHeight?: number | null;
}

const PaperListSkeleton: React.FC<PaperListSkeletonProps> = ({ count = 12, measuredHeight }) => {
  const cardStyle = measuredHeight ? { height: `${measuredHeight}px` } : { minHeight: '160px' };

  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="block" style={cardStyle}>
          <Card className="w-full h-full">
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title skeleton - 2 lines */}
                    <Skeleton className="h-6 w-full mb-2" />
                    <Skeleton className="h-6 w-10/12 mb-2" />
                    
                    {/* Authors skeleton - 1 line */}
                    <Skeleton className="h-4 w-8/12 mb-2" />
                  </div>

                  {/* Vote Button skeleton */}
                  <div className="flex items-center gap-1 p-1">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                </div>
                {/* Abstract */}
                <div className="space-y-2 mt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                </div>
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                {/* Left group: Category tags */}
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>

                {/* Right group: Date, proceeding, and status */}
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </>
  );
};

export default PaperListSkeleton;