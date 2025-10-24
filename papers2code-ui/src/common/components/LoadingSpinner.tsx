import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center w-full max-w-full min-h-[300px] box-border">
      <div className="border-4 border-border border-l-primary rounded-full w-10 h-10 animate-spin"></div>
    </div>
  );
};

export default LoadingSpinner;