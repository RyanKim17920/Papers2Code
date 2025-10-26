import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import ErrorPage from '../../pages/ErrorPage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI using ErrorPage component
      return (
        <ErrorPage
          title="Something went wrong"
          message="We're sorry! An unexpected error occurred."
          details={this.state.error?.message}
          showBackButton={true}
          showHomeButton={true}
          showBrowsePapersButton={true}
          showRefreshButton={true}
        />
      );
    }

    return this.props.children;
  }
}

// Specific error boundaries for different sections
export const PaperListErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <ErrorPage
        title="Unable to load papers"
        message="There was an error loading the papers list. Please try refreshing the page."
        showBackButton={false}
        showHomeButton={true}
        showBrowsePapersButton={false}
        showRefreshButton={true}
      />
    }
  >
    {children}
  </ErrorBoundary>
);

export const PaperDetailErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <ErrorPage
        title="Unable to load paper details"
        message="There was an error loading the paper information. Please try going back or refreshing."
        showBackButton={true}
        showHomeButton={true}
        showBrowsePapersButton={true}
        showRefreshButton={true}
      />
    }
  >
    {children}
  </ErrorBoundary>
);
