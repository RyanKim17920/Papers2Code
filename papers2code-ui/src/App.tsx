// src/App.tsx

// 1. Import QueryClient and QueryClientProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import GlobalHeader from '@/shared/components/GlobalHeader';
import { useToast } from '@/shared/hooks/use-toast';
import { Toaster } from '@/shared/ui/toaster';

// 2. Create a new instance of the QueryClient
// This is done outside the component to prevent it from being recreated on every render.
const queryClient = new QueryClient();
  
function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  // Removed local auth dropdown UI; header handles signed-out UI
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const accountLinkedShownRef = useRef(false);

  // Check for account_linked query parameter and show notification
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('account_linked') === 'true' && !accountLinkedShownRef.current) {
      accountLinkedShownRef.current = true;
      toast({
        title: "Accounts Linked Successfully",
        description: "Your GitHub and Google accounts have been linked. You now have full access to all features.",
        duration: 6000,
      });
      // Clean up URL
      params.delete('account_linked');
      const newSearch = params.toString();
      navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
    }
  }, [location.search, location.pathname, navigate, toast]);

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
    localStorage.removeItem('csrfToken');
    // Reload page to reflect logout state across UI
    window.location.reload();
  };

  // 3. Wrap your existing providers and components with QueryClientProvider
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <AuthInitializer />
          <div className="flex flex-col min-h-screen w-full max-w-full box-border relative before:content-[''] before:fixed before:inset-0 before:w-full before:h-full before:pointer-events-none before:opacity-40 before:bg-[radial-gradient(var(--gradient-accent)_1px,transparent_1px),radial-gradient(var(--gradient-accent)_1px,transparent_1px)] before:bg-[length:40px_40px] before:bg-[0_0,20px_20px] before:z-[-1]">
            <GlobalHeader currentUser={currentUser} handleLogout={handleLogout} />
            <main className="flex-grow p-0 w-full box-border flex flex-col items-stretch justify-start relative overflow-y-auto overflow-x-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-[200px] before:bg-gradient-to-b before:from-[rgba(25,124,154,0.03)] before:to-transparent before:z-[-1] before:pointer-events-none">
              <ErrorBoundary>
                <Suspense fallback={null}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route 
                    path="/papers" 
                    element={
                      <PaperListErrorBoundary>
                        <PaperListPage authLoading={authLoading} />
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

            <footer className="bg-[rgba(241,243,245,0.8)] text-[var(--text-muted-color)] text-center py-4 text-sm border-t border-[var(--border-color-light)]"> 
            </footer>
          </div>
          <Toaster />
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;