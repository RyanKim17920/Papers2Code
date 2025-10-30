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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="w-full max-w-sm px-4">
        {/* Logo and Title */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img 
              src={logo} 
              alt="Papers2Code" 
              className="h-12 w-auto" 
            />
          </div>
          <h1 className="text-2xl font-bold mb-1">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </div>

        {/* Login Options Card */}
        <div className="bg-card border rounded-lg shadow-sm p-6 space-y-3">
          {/* GitHub Login Button */}
          <Button
            onClick={handleGitHubLogin}
            variant="default"
            className="w-full h-10 gap-2"
          >
            <Github className="h-4 w-4" />
            <span>Continue with GitHub</span>
          </Button>

          {/* Divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Google Login Button */}
          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-10 gap-2"
          >
            <GoogleIcon size={16} />
            <span>Continue with Google</span>
          </Button>

          {/* Feature Access Info */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              GitHub accounts have full access. Google accounts can vote and view papers.
              Link both for complete features.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
