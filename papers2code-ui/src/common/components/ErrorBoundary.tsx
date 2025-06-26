import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import './ErrorBoundary.css';

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

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>🚨 Something went wrong</h2>
            <p>We're sorry! An unexpected error occurred.</p>
            <details className="error-details">
              <summary>Error details (click to expand)</summary>
              <pre>{this.state.error?.message}</pre>
              <pre>{this.state.error?.stack}</pre>
            </details>
            <button 
              onClick={() => window.location.reload()}
              className="button-primary"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specific error boundaries for different sections
export const PaperListErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="error-state">
        <div className="error-icon">📋</div>
        <h3>Unable to load papers</h3>
        <p>There was an error loading the papers list. Please try refreshing the page.</p>
        <button onClick={() => window.location.reload()} className="button-secondary">
          Refresh
        </button>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export const PaperDetailErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="error-state">
        <div className="error-icon">📄</div>
        <h3>Unable to load paper details</h3>
        <p>There was an error loading the paper information. Please try going back or refreshing.</p>
        <div className="error-actions">
          <button onClick={() => window.history.back()} className="button-secondary">
            Go Back
          </button>
          <button onClick={() => window.location.reload()} className="button-primary">
            Refresh
          </button>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);
