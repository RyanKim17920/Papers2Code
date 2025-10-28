import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Mail } from 'lucide-react';
import { redirectToGitHubLogin, redirectToGoogleLogin } from '@/shared/services/auth';
import { Button } from '@/shared/ui/button';
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
      <div className="w-full max-w-md p-8">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src={logo} 
              alt="Papers2Code" 
              className="h-16 w-auto" 
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to Papers2Code</h1>
          <p className="text-muted-foreground">
            Sign in to explore, vote on, and implement research papers
          </p>
        </div>

        {/* Login Options Card */}
        <div className="bg-card border rounded-lg shadow-lg p-8 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">
              Choose your preferred sign-in method
            </p>
          </div>

          {/* GitHub Login Button */}
          <Button
            onClick={handleGitHubLogin}
            variant="default"
            className="w-full h-12 text-base gap-3"
          >
            <Github className="h-5 w-5" />
            <span>Continue with GitHub</span>
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-4 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Google Login Button */}
          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-12 text-base gap-3"
          >
            <Mail className="h-5 w-5" />
            <span>Continue with Google</span>
          </Button>

          {/* Feature Access Info */}
          <div className="mt-6 pt-6 border-t">
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Account Features:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>GitHub: Full access including code implementations</li>
                <li>Google: Community features (voting, viewing, profiles)</li>
                <li>Link both accounts for complete access</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
