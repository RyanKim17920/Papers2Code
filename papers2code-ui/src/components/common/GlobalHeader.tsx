import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Command, User, LogOut, ChevronDown, Github } from 'lucide-react';
import logo from '../../assets/images/papers2codelogo.png';
import type { UserProfile } from '../../common/types/user';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { UserAvatar } from '@/common/components';
import { redirectToGitHubLogin } from '@/common/services/auth';

interface GlobalHeaderProps {
  showSearch?: boolean;
  currentUser?: UserProfile | null;
  authSection?: React.ReactNode;
  handleLogout?: () => void;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  showSearch = true,
  currentUser,
  authSection,
  handleLogout
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/papers?searchQuery=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery(''); // Clear the input after search
    } else {
      navigate('/papers');
    }
  };


  // Add keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link 
            to={currentUser ? "/dashboard" : "/"} 
            className="flex items-center space-x-2"
          >
            <img 
              src={logo} 
              alt="Papers2Code" 
              className="h-8 w-auto" 
            />
          </Link>
          
          {/* Search Bar */}
          {showSearch && (
            <div className="flex-1 max-w-2xl mx-8">
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="search"
                    placeholder="Search papers, authors, conferences..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-24 h-10 bg-muted/50 border focus:bg-background transition-colors"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
                      <Command className="h-3 w-3" />K
                    </kbd>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="sr-only"
                  tabIndex={-1}
                >
                  Search
                </Button>
              </form>
            </div>
          )}
          
          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <Link to="/papers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Papers
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 h-9 px-3">
                      <Avatar className="h-6 w-6">
                        <UserAvatar
                          avatarUrl={currentUser.avatarUrl}
                          username={currentUser.username}
                          className="user-avatar"
                        />
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground flex items-center justify-center h-full w-full">
                          {currentUser.avatarUrl
                            ? null
                            : (currentUser.username?.charAt(0).toUpperCase() || 'U')}
                        </AvatarFallback></Avatar>
                      <span className="text-sm font-medium">{currentUser.username}</span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link to={`/user/${currentUser.username}`} className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        handleLogout?.();
                      }}
                      className="flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // If a custom authSection is provided by parent, render it.
              authSection ?? (
                <div className="flex items-center gap-3">
                  <Link to="/papers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Papers
                  </Link>
                  <Button
                    onClick={redirectToGitHubLogin}
                    variant="default"
                    className="h-9 px-3 gap-2"
                  >
                    <Github className="h-4 w-4" />
                    <span className="text-sm">Sign in with GitHub</span>
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;
