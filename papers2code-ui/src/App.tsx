// src/App.tsx

// 1. Import QueryClient and QueryClientProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const PaperListPage = lazy(() => import('@/features/paper-list/PaperListPage'));
const PaperDetailPage = lazy(() => import('@/features/paper-detail/PaperDetailPage'));
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const NotFoundPage = lazy(() => import('@/features/auth/NotFoundPage'));

import { checkCurrentUser, logoutUser, fetchAndStoreCsrfToken } from '@/shared/services/auth';
import type { UserProfile } from '@/shared/types/user';
import AuthInitializer from '@/shared/components/AuthInitializer';
import { ModalProvider } from '@/shared/contexts/ModalContext';
import LoginPromptModal from '@/shared/components/LoginPromptModal';
import { ErrorBoundary, PaperListErrorBoundary, PaperDetailErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AuthenticationError } from '@/shared/services/api';
import GlobalHeader from "@/shared/components/GlobalHeader";
import { useToast } from "@/shared/hooks/use-toast";
import { AccountLinkModal } from "@/features/auth/AccountLinkModal";

// 2. Create a new instance of the QueryClient
// This is done outside the component to prevent it from being recreated on every render.
const queryClient = new QueryClient();
  
function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalData, setLinkModalData] = useState<any>(null);
  // Removed local auth dropdown UI; header handles signed-out UI
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check for pending_link query parameter and show modal
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pendingToken = params.get('pending_link');
    
    if (pendingToken) {
      // Decode the JWT token to get account information
      try {
        const payload = JSON.parse(atob(pendingToken.split('.')[1]));
        
        // Determine which provider is which
        let existingAccount, newAccount;
        
        if (payload.google_id) {
          // Google is the new account, GitHub is existing
          existingAccount = {
            username: payload.existing_username,
            avatar: payload.existing_avatar,
            provider: 'github' as const,
          };
          newAccount = {
            username: payload.google_email?.split('@')[0] || 'Google User',
            avatar: payload.google_avatar,
            provider: 'google' as const,
          };
        } else {
          // GitHub is the new account, Google is existing
          existingAccount = {
            username: payload.existing_username,
            avatar: payload.existing_avatar,
            provider: 'google' as const,
          };
          newAccount = {
            username: payload.github_username,
            avatar: payload.github_avatar,
            provider: 'github' as const,
          };
        }
        
        setLinkModalData({
          pendingToken,
          existingAccount,
          newAccount,
        });
        setShowLinkModal(true);
        
        // Clean up URL
        params.delete('pending_link');
        const newSearch = params.toString();
        navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
      } catch (error) {
        console.error('Error parsing pending link token:', error);
        toast({
          title: "Error",
          description: "Invalid account linking request. Please try logging in again.",
          variant: "destructive",
        });
      }
    }
  }, [location.search, location.pathname, navigate, toast]);

  const handleLinkAccounts = async () => {
    try {
      const response = await fetch('/api/auth/link-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pending_token: linkModalData.pendingToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to link accounts');
      }

      setShowLinkModal(false);
      toast({
        title: "Accounts Linked Successfully",
        description: "Your GitHub and Google accounts have been linked. You now have full access to all features.",
        duration: 6000,
      });

      // Refresh user data
      const user = await checkCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error linking accounts:', error);
      toast({
        title: "Error",
        description: "Failed to link accounts. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeepSeparate = () => {
    setShowLinkModal(false);
    toast({
      title: "Accounts Not Linked",
      description: "You can sign in with either account separately.",
      duration: 4000,
    });
    // Redirect to login page
    navigate('/login');
  };

  // ... (rest of your existing useEffect and handler functions remain the same)
  useEffect(() => {
    const initializeApp = async () => {
      setAuthLoading(true);
      await fetchAndStoreCsrfToken();
      try {
        const user = await checkCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        if (error instanceof AuthenticationError) {
          setCurrentUser(null);
        } else {
          console.error("Error initializing app:", error);
        }
      } finally {
        setAuthLoading(false);
      }
    };
    initializeApp();
  }, [location.pathname]);

  // No dropdown in App; handled in GlobalHeader

  if (authLoading) {
    return null;
  }

  if (currentUser && location.pathname === "/") {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    // Note: CSRF token is stored in-memory and will be cleared on reload
    // Reload page to reflect logout state across UI
    window.location.reload();
  };

  const isLoginPage = location.pathname === '/login';

  // 3. Wrap your existing providers and components with QueryClientProvider
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <AuthInitializer />
        <div className={`flex flex-col w-full max-w-full box-border relative before:content-[''] before:fixed before:inset-0 before:w-full before:h-full before:pointer-events-none before:opacity-40 before:bg-[radial-gradient(var(--gradient-accent)_1px,transparent_1px),radial-gradient(var(--gradient-accent)_1px,transparent_1px)] before:bg-[length:40px_40px] before:bg-[0_0,20px_20px] before:z-[-1] ${isLoginPage ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
          <GlobalHeader currentUser={currentUser} handleLogout={handleLogout} />
          <main className={`flex-grow p-0 w-full box-border flex flex-col items-stretch justify-start relative ${isLoginPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-[200px] before:bg-gradient-to-b before:from-[rgba(25,124,154,0.03)] before:to-transparent before:z-[-1] before:pointer-events-none`}>
            <ErrorBoundary>
              <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route 
                  path="/papers" 
                  element={
                    <PaperListErrorBoundary>
                      <PaperListPage authLoading={authLoading} currentUser={currentUser} />
                    </PaperListErrorBoundary>
                  } 
                />
                <Route
                  path="/paper/:paperId"
                  element={
                    <PaperDetailErrorBoundary>
                      <PaperDetailPage currentUser={currentUser} />
                    </PaperDetailErrorBoundary>
                  }
                />              
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/user/:github_username" element={<ProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>          
          <LoginPromptModal />
          
          {/* Account Link Modal */}
          {linkModalData && (
            <AccountLinkModal
              open={showLinkModal}
              onClose={() => setShowLinkModal(false)}
              existingAccount={linkModalData.existingAccount}
              newAccount={linkModalData.newAccount}
              onConfirm={handleLinkAccounts}
              onCancel={handleKeepSeparate}
            />
          )}
          
          {/* Vercel Speed Insights */}
          <SpeedInsights />
        </div>
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;