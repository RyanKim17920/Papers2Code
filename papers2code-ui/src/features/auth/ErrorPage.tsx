import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, Search, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";

interface ErrorPageProps {
  errorCode?: string | number;
  title?: string;
  message?: string;
  details?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showBrowsePapersButton?: boolean;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({
  errorCode = "Error",
  title = "Something went wrong",
  message = "We encountered an unexpected error. Please try again.",
  details,
  showBackButton = true,
  showHomeButton = true,
  showBrowsePapersButton = true,
  showRefreshButton = false,
  onRefresh,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      `${errorCode} Error:`,
      title,
      message,
      details || ""
    );
  }, [errorCode, title, message, details]);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Animated error code/icon */}
        <div className="relative mb-8">
          {typeof errorCode === "number" || !isNaN(Number(errorCode)) ? (
            <>
              <h1 className="text-8xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-destructive to-destructive/60 animate-pulse">
                {errorCode}
              </h1>
              <div className="absolute inset-0 text-8xl md:text-9xl font-bold text-destructive/10 blur-sm">
                {errorCode}
              </div>
            </>
          ) : (
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-32 h-32 text-destructive animate-pulse" />
            </div>
          )}
        </div>

        {/* Main message */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
            {title}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            {message}
          </p>
          {details && (
            <p className="text-sm text-muted-foreground/80 mt-2">
              Details: <code className="bg-muted px-2 py-1 rounded text-xs">{details}</code>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          )}
          {showRefreshButton && (
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors duration-200 font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          )}
          {showHomeButton && (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors duration-200 font-medium"
            >
              <Home className="w-5 h-5" />
              Home
            </button>
          )}
          {showBrowsePapersButton && (
            <button
              onClick={() => navigate('/papers')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-accent-foreground rounded-lg transition-colors duration-200 font-medium"
            >
              <Search className="w-5 h-5" />
              Papers
            </button>
          )}
        </div>

        {/* Decorative elements */}
        <div className="mt-12 opacity-30">
          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-destructive to-transparent mx-auto rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
