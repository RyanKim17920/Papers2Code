import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { Github, Mail, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

interface AccountData {
  username: string;
  avatar: string;
  provider: 'github' | 'google';
}

interface AccountLinkModalProps {
  open: boolean;
  onClose: () => void;
  existingAccount: AccountData;
  newAccount: AccountData;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function AccountLinkModal({
  open,
  onClose,
  existingAccount,
  newAccount,
  onConfirm,
  onCancel,
  loading = false,
}: AccountLinkModalProps) {
  const [isLinking, setIsLinking] = useState(false);

  const handleConfirm = async () => {
    setIsLinking(true);
    await onConfirm();
    setIsLinking(false);
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Your Accounts?</DialogTitle>
          <DialogDescription>
            We found an existing account with the same email address. Would you like to link these accounts?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Linking accounts will merge your data and allow you to sign in with either provider.
            </AlertDescription>
          </Alert>

          {/* Existing Account */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-3 mb-2">
              {existingAccount.provider === 'github' ? (
                <Github className="h-5 w-5" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
              <span className="font-medium">Existing Account</span>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={existingAccount.avatar} alt={existingAccount.username} />
                <AvatarFallback>{existingAccount.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{existingAccount.username}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {existingAccount.provider} Account
                </p>
              </div>
            </div>
          </div>

          {/* New Account */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-3 mb-2">
              {newAccount.provider === 'github' ? (
                <Github className="h-5 w-5" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
              <span className="font-medium">Sign-in Attempt</span>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={newAccount.avatar} alt={newAccount.username} />
                <AvatarFallback>{newAccount.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{newAccount.username}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {newAccount.provider} Account
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleConfirm}
            disabled={isLinking || loading}
            className="w-full"
          >
            {isLinking ? 'Linking Accounts...' : 'Yes, Link These Accounts'}
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            disabled={isLinking || loading}
            className="w-full"
          >
            No, Keep Them Separate
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          If you keep them separate, you'll need to use the same email to sign in.
        </p>
      </DialogContent>
    </Dialog>
  );
}
