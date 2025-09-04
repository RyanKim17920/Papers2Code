import React from 'react';
import { LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserProfile } from '@/common/types/user';

interface ModernUserProfileProps {
  user: UserProfile | null;
  onLogout: () => void;
  onNewContribution: () => void;
}

export const ModernUserProfile: React.FC<ModernUserProfileProps> = ({
  user,
  onLogout,
  onNewContribution,
}) => {
  if (!user) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-4">
          <div className="w-12 h-12 bg-muted rounded-full" />
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Info */}
      <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 border border-border/50">
        <Avatar className="w-10 h-10">
          <AvatarImage src={user.avatarUrl} alt={user.username} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {user.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {user.username}
          </p>
          <p className="text-xs text-muted-foreground">Research Professional</p>
        </div>
      </div>

  {/* Quick Stats (not available in UserProfile type) */}

      {/* Actions */}
      <div className="space-y-2">
        <Button 
          onClick={onNewContribution} 
          className="w-full"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Paper
        </Button>
        
        <Button 
          onClick={onLogout} 
          variant="outline" 
          size="sm"
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};