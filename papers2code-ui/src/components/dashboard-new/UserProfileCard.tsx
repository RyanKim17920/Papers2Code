import React from 'react';
import { User, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import type { UserProfile } from '@/common/types/user';
interface UserProfileCardProps {
  user: UserProfile | null;
  onLogout: () => void;
  onNewContribution: () => void;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  onLogout,
  onNewContribution,
}) => {
  if (!user) {
    return (
      <div className="research-section">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Not logged in</p>
          </div>
        </div>
      </div>
    );
  }

  const userInitials = user.username
    ? user.username
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="research-section">
      <div className="flex flex-col space-y-4">
        {/* User Avatar and Info */}
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatarUrl} alt={user.username} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {user.username}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              @{user.username}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2">
          <Button
            onClick={onNewContribution}
            className="w-full"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Contribution
          </Button>
          
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* User Stats (Optional - can be populated from user data) */}
        {user.stats && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {user.stats.contributions || 0}
              </div>
              <div className="text-xs text-muted-foreground">Papers</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {user.stats.citations || 0}
              </div>
              <div className="text-xs text-muted-foreground">Citations</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};