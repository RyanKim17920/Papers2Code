import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Github } from 'lucide-react';
import { redirectToGitHubLogin, redirectToGoogleLogin } from '@/shared/services/auth';
import { Button } from '@/shared/ui/button';
import { GoogleIcon } from '@/shared/components/GoogleIcon';
import logo from '../../assets/images/papers2codelogo.png';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGitHubLogin = () => {
    redirectToGitHubLogin();
  };

  const handleGoogleLogin = () => {
    redirectToGoogleLogin();
  };

  return (
    <div className="h-full w-full flex bg-background overflow-hidden">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          <img 
            src={logo} 
            alt="Papers2Code" 
            className="h-20 w-auto mb-8" 
          />
          <p className="text-lg text-muted-foreground text-center max-w-md">
            Bridging the gap between research papers and production-ready code
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-4">
            <img 
              src={logo} 
              alt="Papers2Code" 
              className="h-10 w-auto" 
            />
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
            <p className="text-muted-foreground text-sm">
              Sign in to continue to Papers2Code
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-card border rounded-xl shadow-lg p-6 space-y-4">
            {/* GitHub Login Button */}
            <Button
              onClick={handleGitHubLogin}
              variant="default"
              size="lg"
              className="w-full gap-3 h-12 text-base font-medium"
            >
              <Github className="h-5 w-5" />
              <span>Continue with GitHub</span>
            </Button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-3 text-muted-foreground font-medium">or</span>
              </div>
            </div>

            {/* Google Login Button */}
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              size="lg"
              className="w-full gap-3 h-12 text-base font-medium"
            >
              <GoogleIcon size={20} />
              <span>Continue with Google</span>
            </Button>

            {/* Feature Access Info */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">GitHub accounts</span> have full access. 
                  <span className="font-semibold text-foreground"> Google accounts</span> can vote and view papers.
                  Link both for complete features.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
            >
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
