import React from 'react';
import './LoadingSpinner.css'; // Add basic CSS for animation

const LoadingSpinner: React.FC = () => {
  return <div className="spinner-container"><div className="loading-spinner"></div></div>;
};

export default LoadingSpinner;