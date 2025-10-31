import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Trash2, Globe, Twitter, Linkedin, User, Bell, Github, Mail } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { logoutUser } from '@/shared/services/auth';
import { updateUserProfile, deleteUserAccount } from '@/shared/services/api';
import { useToast } from '@/shared/hooks/use-toast';
import { 
  normalizeLinkedInUrl, 
  normalizeTwitterUrl, 
  normalizeWebsiteUrl,
  normalizeBlueskyHandle, 
  normalizeHuggingFaceUsername,
  convertDisplayToApiValue,
  type NormalizedUrlResult
} from '@/shared/utils/urlNormalization';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import { ThemeSettings } from '@/shared/components/ThemeSettings';

interface UserProfileFormData {
  name: string;
  bio: string;
  websiteUrl: string;
  twitterProfileUrl: string;
  linkedinProfileUrl: string;
  blueskyUsername: string;
  huggingfaceUsername: string;
  preferredAvatarSource?: string;
}

interface FieldValidation {
  isValid: boolean;
  errorMessage?: string;
}

interface ProfileSettingsTabProps {
  currentUser: {
    id: string;
    username: string;
    name?: string | null;
    bio?: string | null;
    websiteUrl?: string | null;
    twitterProfileUrl?: string | null;
    linkedinProfileUrl?: string | null;
    blueskyUsername?: string | null;
    huggingfaceUsername?: string | null;
    email?: string | null;
    githubId?: number | null;
    googleId?: string | null;
    githubAvatarUrl?: string | null;
    googleAvatarUrl?: string | null;
    preferredAvatarSource?: string;
  };
  onProfileUpdate?: () => void;
}

export const ProfileSettingsTab: React.FC<ProfileSettingsTabProps> = ({ currentUser, onProfileUpdate }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState<UserProfileFormData>({
    name: currentUser.name || '',
    bio: currentUser.bio || '',
    websiteUrl: normalizeWebsiteUrl(currentUser.websiteUrl || '').displayValue,
    twitterProfileUrl: normalizeTwitterUrl(currentUser.twitterProfileUrl || '').displayValue,
    linkedinProfileUrl: normalizeLinkedInUrl(currentUser.linkedinProfileUrl || '').displayValue,
    blueskyUsername: normalizeBlueskyHandle(currentUser.blueskyUsername || '').displayValue,
    huggingfaceUsername: normalizeHuggingFaceUsername(currentUser.huggingfaceUsername || '').displayValue,
    preferredAvatarSource: currentUser.preferredAvatarSource || 'github',
  });

  const [fieldValidation, setFieldValidation] = useState<Record<string, FieldValidation>>({});

  const handleInputChange = (field: keyof UserProfileFormData, value: string) => {
    let normalizedResult: NormalizedUrlResult;
    
    switch (field) {
      case 'linkedinProfileUrl':
        normalizedResult = normalizeLinkedInUrl(value);
        setFieldValidation(prev => ({
          ...prev,
          [field]: { isValid: normalizedResult.isValid, errorMessage: normalizedResult.errorMessage }
        }));
        break;
        
      case 'twitterProfileUrl':
        normalizedResult = normalizeTwitterUrl(value);
        setFieldValidation(prev => ({
          ...prev,
          [field]: { isValid: normalizedResult.isValid, errorMessage: normalizedResult.errorMessage }
        }));
        break;
        
      case 'blueskyUsername':
        normalizedResult = normalizeBlueskyHandle(value);
        setFieldValidation(prev => ({
          ...prev,
          [field]: { isValid: normalizedResult.isValid, errorMessage: normalizedResult.errorMessage }
        }));
        break;
        
      case 'huggingfaceUsername':
        normalizedResult = normalizeHuggingFaceUsername(value);
        setFieldValidation(prev => ({
          ...prev,
          [field]: { isValid: normalizedResult.isValid, errorMessage: normalizedResult.errorMessage }
        }));
        break;
        
      case 'websiteUrl':
        normalizedResult = normalizeWebsiteUrl(value);
        setFieldValidation(prev => ({
          ...prev,
          [field]: { isValid: normalizedResult.isValid, errorMessage: normalizedResult.errorMessage }
        }));
        break;
        
      default:
        setFieldValidation(prev => ({
          ...prev,
          [field]: { isValid: true }
        }));
        break;
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const hasValidationErrors = Object.values(fieldValidation).some(
      validation => validation.isValid === false
    );
    
    if (hasValidationErrors) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the validation errors before submitting.',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    try {
      const cleanedFormData = Object.fromEntries(
        Object.entries(formData)
          .map(([key, value]) => [key, convertDisplayToApiValue(key, value)])
      );
      
      await updateUserProfile(cleanedFormData);
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully!',
      });
      
      if (onProfileUpdate) {
        onProfileUpdate();
      }
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    // Note: CSRF token is stored in-memory and will be cleared on reload
    navigate('/');
    window.location.reload();
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      toast({
        title: 'Account Deleted',
        description: 'Your account has been deleted successfully.',
      });
      await handleLogout();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete account',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Theme Settings */}
      <ThemeSettings />

      {/* Profile Information */}
      <Card className="border-none shadow-lg">
        <CardHeader className="pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Profile Information</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Update your public profile information and social links
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* GitHub info - only show if user has GitHub account linked */}
          {currentUser.githubId && (
            <div className="mb-6 p-4 bg-gradient-to-br from-muted/80 to-muted/40 rounded-xl border border-border/50">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Github className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold mb-0.5">GitHub Account</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">@{currentUser.username}</span> • Managed externally
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 text-xs"
                >
                  <a 
                    href="https://github.com/settings/profile"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Edit on GitHub
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Avatar Selection - Show only if user has both GitHub and Google accounts */}
          {currentUser.githubId && currentUser.googleId && currentUser.githubAvatarUrl && currentUser.googleAvatarUrl && (
            <div className="mb-6 p-5 bg-gradient-to-br from-primary/5 to-transparent rounded-xl border border-border/50">
              <div className="mb-4">
                <p className="text-sm font-semibold mb-1">Profile Avatar</p>
                <p className="text-xs text-muted-foreground">
                  Choose which avatar to display on your profile
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={formData.preferredAvatarSource === 'github' ? 'default' : 'outline'}
                  size="lg"
                  className="h-auto py-4 flex flex-col items-center gap-3 relative"
                  onClick={() => setFormData(prev => ({ ...prev, preferredAvatarSource: 'github' }))}
                >
                  {formData.preferredAvatarSource === 'github' && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                  <Github className="h-5 w-5" />
                  <span className="text-sm font-medium">GitHub</span>
                  {currentUser.githubAvatarUrl && (
                    <img src={currentUser.githubAvatarUrl} alt="GitHub" className="w-16 h-16 rounded-full border-2 border-border" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant={formData.preferredAvatarSource === 'google' ? 'default' : 'outline'}
                  size="lg"
                  className="h-auto py-4 flex flex-col items-center gap-3 relative"
                  onClick={() => setFormData(prev => ({ ...prev, preferredAvatarSource: 'google' }))}
                >
                  {formData.preferredAvatarSource === 'google' && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                  <Mail className="h-5 w-5" />
                  <span className="text-sm font-medium">Google</span>
                  {currentUser.googleAvatarUrl && (
                    <img src={currentUser.googleAvatarUrl} alt="Google" className="w-16 h-16 rounded-full border-2 border-border" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Display Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Your display name"
                  className="h-10"
                />
                {!fieldValidation.name?.isValid && (
                  <p className="text-xs text-muted-foreground">
                    This will be shown instead of your GitHub username
                  </p>
                )}
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-2 text-sm font-medium">
                  <Globe size={14} />
                  Website
                </Label>
                <Input
                  id="website"
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  placeholder="example.com"
                  className={`h-10 ${fieldValidation.websiteUrl?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.websiteUrl?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.websiteUrl?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="twitter" className="flex items-center gap-2 text-sm font-medium">
                  <Twitter size={14} />
                  Twitter
                </Label>
                <Input
                  id="twitter"
                  value={formData.twitterProfileUrl}
                  onChange={(e) => handleInputChange('twitterProfileUrl', e.target.value)}
                  placeholder="username or URL"
                  className={`h-10 ${fieldValidation.twitterProfileUrl?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.twitterProfileUrl?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.twitterProfileUrl?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="linkedin" className="flex items-center gap-2 text-sm font-medium">
                  <Linkedin size={14} />
                  LinkedIn
                </Label>
                <Input
                  id="linkedin"
                  value={formData.linkedinProfileUrl}
                  onChange={(e) => handleInputChange('linkedinProfileUrl', e.target.value)}
                  placeholder="username or URL"
                  className={`h-10 ${fieldValidation.linkedinProfileUrl?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.linkedinProfileUrl?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.linkedinProfileUrl?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bluesky" className="text-sm font-medium">Bluesky</Label>
                <Input
                  id="bluesky"
                  value={formData.blueskyUsername}
                  onChange={(e) => handleInputChange('blueskyUsername', e.target.value)}
                  placeholder="username.bsky.social"
                  className={`h-10 ${fieldValidation.blueskyUsername?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.blueskyUsername?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.blueskyUsername?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="huggingface" className="text-sm font-medium">Hugging Face</Label>
                <Input
                  id="huggingface"
                  value={formData.huggingfaceUsername}
                  onChange={(e) => handleInputChange('huggingfaceUsername', e.target.value)}
                  placeholder="username or URL"
                  className={`h-10 ${fieldValidation.huggingfaceUsername?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.huggingfaceUsername?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.huggingfaceUsername?.errorMessage}</p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving} size="lg" className="w-full md:w-auto px-8">
                {saving ? 'Saving Changes...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>



      {/* Notifications */}
      <Card className="border-none shadow-lg">
        <CardHeader className="pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Notification Preferences</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Manage your email and on-site notification preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8 text-center">
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                <Bell size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Notification settings will be available soon</p>
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-xs rounded-full font-semibold">
                Coming Soon
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card className="border-destructive/30 shadow-lg">
        <CardHeader className="pb-4 border-b bg-gradient-to-r from-destructive/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Settings size={20} className="text-destructive" />
            </div>
            <div>
              <CardTitle className="text-xl text-destructive">Account Actions</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Manage your account settings and security
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline"
              size="lg"
              onClick={handleLogout}
              className="flex items-center gap-2 h-11 flex-1"
            >
              <LogOut size={16} />
              Log Out
            </Button>
            
            <Button
              variant="destructive"
              size="lg"
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 h-11 flex-1"
            >
              <Trash2 size={16} />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Account"
        confirmText="Delete Account"
        cancelText="Cancel"
        confirmButtonClass="btn-danger"
        isConfirming={isDeleting}
      >
        <p>
          Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.
        </p>
      </ConfirmationModal>
    </div>
  );
};
