import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Command } from 'lucide-react';
import logo from '../../assets/images/papers2codelogo.png';
import type { UserProfile } from '../../common/types/user';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface GlobalHeaderProps {
  showSearch?: boolean;
  currentUser?: UserProfile | null;
  authSection?: React.ReactNode;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  showSearch = true,
  currentUser,
  authSection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/papers?search=${encodeURIComponent(searchQuery.trim())}`);
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
                    className="w-full pl-10 pr-24 h-10 bg-muted/50 border-0 focus:bg-background transition-colors"
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
            {authSection}
          </div>
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;
