import React from 'react';
import { Skeleton } from '../ui/skeleton';

const PaginationSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-center gap-5 py-5">
      {/* Previous Button */}
      <div className="flex items-center gap-1 h-9">
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-10 rounded-md" />
        ))}
      </div>

      {/* Next Button */}
      <div className="flex items-center gap-1 h-9">
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Go to Page */}
      <div className="flex items-center gap-2 ml-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-9 w-16 rounded-md" />
        <Skeleton className="h-9 w-12 rounded-md" />
      </div>
    </div>
  );
};

export default PaginationSkeleton;
