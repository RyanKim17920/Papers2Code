import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserAvatar } from '../../common/components';
import type { UserProfile } from '../../common/types/user';
import { logoutUser } from '../../common/services/auth';

interface CompactUserProfileProps {
  user: UserProfile;
  onLogout?: () => void;
}

const CompactUserProfile: React.FC<CompactUserProfileProps> = ({ user, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      if (onLogout) {
        onLogout();
      }
      navigate('/papers');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown} 
        className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-[#d0d7de] rounded-md cursor-pointer transition-all duration-200 text-[#24292f] text-sm min-w-[120px] hover:bg-[#f6f8fa] hover:border-[#0969da] md:min-w-0 md:px-2 md:py-1"
      >
        <UserAvatar
          avatarUrl={user.avatarUrl}
          username={user.username}
          className="w-5 h-5 rounded-full flex-shrink-0"
        />
        <span className="font-medium overflow-hidden text-ellipsis whitespace-nowrap flex-1 text-left md:hidden">{user.username}</span>
        <svg 
          className={`flex-shrink-0 transition-transform duration-200 text-[#656d76] ${isDropdownOpen ? 'rotate-180' : ''}`}
          width="16" 
          height="16" 
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
        </svg>
      </button>

      {isDropdownOpen && (
        <div className="absolute top-full right-0 z-[1000] bg-white border border-[#d0d7de] rounded-md shadow-[0_8px_24px_rgba(140,149,159,0.2)] min-w-[200px] mt-1 overflow-hidden md:right-[-0.5rem] md:min-w-[180px]">
          <div className="flex items-center gap-3 px-4 py-4 bg-[#f6f8fa] border-b border-[#d0d7de] md:px-3 md:py-3">
            <UserAvatar
              avatarUrl={user.avatarUrl}
              username={user.username}
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#24292f] text-sm leading-tight">{user.username}</div>
              {user.name && <div className="text-[#656d76] text-xs leading-tight mt-0.5">{user.name}</div>}
            </div>
          </div>
          
          <div className="h-px bg-[#d0d7de] m-0"></div>
          
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-[#24292f] no-underline bg-transparent border-none w-full text-left cursor-pointer text-sm transition-colors duration-200 hover:bg-[#f6f8fa] md:px-3 md:py-2.5" onClick={closeDropdown}>
            <svg className="text-[#656d76] flex-shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zm.5 4.75a.75.75 0 00-1.5 0v3.5h-2a.75.75 0 000 1.5h2.75a.75.75 0 00.75-.75v-4.25z"/>
            </svg>
            Dashboard
          </Link>
          
          <Link to={`/user/${user.username}`} className="flex items-center gap-3 px-4 py-3 text-[#24292f] no-underline bg-transparent border-none w-full text-left cursor-pointer text-sm transition-colors duration-200 hover:bg-[#f6f8fa] md:px-3 md:py-2.5" onClick={closeDropdown}>
            <svg className="text-[#656d76] flex-shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2 8a6 6 0 1112 0 6 6 0 01-12 0zm6-3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            </svg>
            Profile
          </Link>
          
          <div className="h-px bg-[#d0d7de] m-0"></div>
          
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-[#cf222e] bg-transparent border-none w-full text-left cursor-pointer text-sm transition-colors duration-200 hover:bg-[#ffebee] md:px-3 md:py-2.5">
            <svg className="text-[#cf222e] flex-shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 010 1.5h-2.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h2.5a.75.75 0 010 1.5h-2.5A1.75 1.75 0 012 14.25V2.75zm6.56 4.5l1.97-1.97a.75.75 0 10-1.06-1.06L6.22 7.47a.75.75 0 000 1.06l3.25 3.25a.75.75 0 101.06-1.06L8.56 8.75h5.69a.75.75 0 000-1.5H8.56z"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default CompactUserProfile;
