import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';

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
          <Card className="w-full h-full overflow-hidden">
            <CardContent className="p-4 sm:p-5 h-full flex flex-col">
              <div className="flex-1">
                {/* Title skeleton - matches larger font-semibold text-lg */}
                <Skeleton className="h-5 sm:h-6 w-full mb-1" />
                <Skeleton className="h-5 sm:h-6 w-4/5 mb-2.5" />
                
                {/* Authors and metadata line */}
                <div className="flex items-center gap-2 mb-2.5">
                  <Skeleton className="h-[14px] sm:h-4 w-32" />
                  <Skeleton className="h-[10px] sm:h-3 w-1 rounded-full" />
                  <Skeleton className="h-[14px] sm:h-4 w-16" />
                  <Skeleton className="h-[10px] sm:h-3 w-1 rounded-full" />
                  <Skeleton className="h-[14px] sm:h-4 w-20" />
                </div>

                <Separator className="mb-3" />

                {/* TL;DR section */}
                <div className="mb-3">
                  <Skeleton className="h-[14px] sm:h-4 w-12 mb-2" />
                  <Skeleton className="h-[10px] sm:h-3 w-full mb-1" />
                  <Skeleton className="h-[10px] sm:h-3 w-5/6" />
                </div>

                <Separator className="mb-3" />

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Skeleton className="h-[18px] sm:h-5 w-20 rounded-full" />
                  <Skeleton className="h-[18px] sm:h-5 w-16 rounded-full" />
                  <Skeleton className="h-[18px] sm:h-5 w-24 rounded-full" />
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-[18px] sm:h-6 w-20 rounded-md" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Skeleton className="h-[18px] sm:h-6 w-6 rounded-sm" />
                  <Skeleton className="h-[18px] sm:h-6 w-6 rounded-sm" />
                  <Skeleton className="h-[18px] sm:h-6 w-6 rounded-sm" />
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