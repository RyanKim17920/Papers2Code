import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, Search, ArrowLeft } from "lucide-react";

const NotFoundPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Animated 404 number */}
        <div className="relative mb-8">
          <h1 className="text-8xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 animate-pulse">
            404
          </h1>
          <div className="absolute inset-0 text-8xl md:text-9xl font-bold text-primary/10 blur-sm">
            404
          </div>
        </div>

        {/* Main message */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
            Page Not Found
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <p className="text-sm text-muted-foreground/80 mt-2">
            Route: <code className="bg-muted px-2 py-1 rounded text-xs">{location.pathname}</code>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors duration-200 font-medium"
          >
            <Home className="w-5 h-5" />
            Home
          </button>
          <button
            onClick={() => navigate('/papers')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-accent-foreground rounded-lg transition-colors duration-200 font-medium"
          >
            <Search className="w-5 h-5" />
            Papers
          </button>
        </div>

        {/* Decorative elements */}
        <div className="mt-12 opacity-30">
          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;