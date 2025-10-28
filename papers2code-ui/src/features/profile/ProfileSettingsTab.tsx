import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Trash2, Globe, Twitter, Linkedin, User, FileText, Bell, Lock, Eye, EyeOff } from 'lucide-react';
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

interface UserProfileFormData {
  name: string;
  bio: string;
  websiteUrl: string;
  twitterProfileUrl: string;
  linkedinProfileUrl: string;
  blueskyUsername: string;
  huggingfaceUsername: string;
  showEmail?: boolean;
  showGithub?: boolean;
  showSocialLinks?: boolean;
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
    showEmail?: boolean;
    showGithub?: boolean;
    showSocialLinks?: boolean;
    email?: string | null;
    githubId?: number | null;
    googleId?: string | null;
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
    showEmail: currentUser.showEmail ?? true,
    showGithub: currentUser.showGithub ?? true,
    showSocialLinks: currentUser.showSocialLinks ?? true,
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
    localStorage.removeItem('csrfToken');
    navigate('/papers');
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
    <div className="space-y-4 max-w-4xl">
      {/* Profile Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User size={18} />
            Profile Information
          </CardTitle>
          <CardDescription className="text-xs">
            Update your public profile information and social links
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* GitHub info */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs font-medium mb-1">GitHub Account (Managed externally)</p>
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Username:</strong> {currentUser.username}
            </p>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 text-xs"
            >
              <a 
                href="https://github.com/settings/profile"
                target="_blank"
                rel="noopener noreferrer"
              >
                Edit Username & Avatar on GitHub
              </a>
            </Button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">Display Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Your display name"
                  className="h-9"
                />
                {!fieldValidation.name?.isValid && (
                  <p className="text-xs text-muted-foreground">
                    This will be shown instead of your GitHub username
                  </p>
                )}
              </div>
              
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="bio" className="text-sm">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={2}
                  className="resize-none"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="website" className="flex items-center gap-1.5 text-sm">
                  <Globe size={13} />
                  Website
                </Label>
                <Input
                  id="website"
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  placeholder="example.com"
                  className={`h-9 ${fieldValidation.websiteUrl?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.websiteUrl?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.websiteUrl?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="twitter" className="flex items-center gap-1.5 text-sm">
                  <Twitter size={13} />
                  Twitter
                </Label>
                <Input
                  id="twitter"
                  value={formData.twitterProfileUrl}
                  onChange={(e) => handleInputChange('twitterProfileUrl', e.target.value)}
                  placeholder="username or URL"
                  className={`h-9 ${fieldValidation.twitterProfileUrl?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.twitterProfileUrl?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.twitterProfileUrl?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="linkedin" className="flex items-center gap-1.5 text-sm">
                  <Linkedin size={13} />
                  LinkedIn
                </Label>
                <Input
                  id="linkedin"
                  value={formData.linkedinProfileUrl}
                  onChange={(e) => handleInputChange('linkedinProfileUrl', e.target.value)}
                  placeholder="username or URL"
                  className={`h-9 ${fieldValidation.linkedinProfileUrl?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.linkedinProfileUrl?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.linkedinProfileUrl?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="bluesky" className="text-sm">Bluesky</Label>
                <Input
                  id="bluesky"
                  value={formData.blueskyUsername}
                  onChange={(e) => handleInputChange('blueskyUsername', e.target.value)}
                  placeholder="username.bsky.social"
                  className={`h-9 ${fieldValidation.blueskyUsername?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.blueskyUsername?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.blueskyUsername?.errorMessage}</p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="huggingface" className="text-sm">Hugging Face</Label>
                <Input
                  id="huggingface"
                  value={formData.huggingfaceUsername}
                  onChange={(e) => handleInputChange('huggingfaceUsername', e.target.value)}
                  placeholder="username or URL"
                  className={`h-9 ${fieldValidation.huggingfaceUsername?.isValid === false ? 'border-destructive' : ''}`}
                />
                {fieldValidation.huggingfaceUsername?.isValid === false && (
                  <p className="text-xs text-destructive">{fieldValidation.huggingfaceUsername?.errorMessage}</p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full md:w-auto">
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock size={18} />
            Privacy Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Control who can see your personal information on your public profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Email Visibility */}
            {currentUser.email && (
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Label htmlFor="showEmail" className="text-sm font-medium cursor-pointer">
                      Show Email Address
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Display your email ({currentUser.email}) on your public profile
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setFormData(prev => ({ ...prev, showEmail: !prev.showEmail }))}
                  >
                    {formData.showEmail ? (
                      <Eye size={16} className="text-green-600" />
                    ) : (
                      <EyeOff size={16} className="text-muted-foreground" />
                    )}
                  </Button>
                  <input
                    id="showEmail"
                    type="checkbox"
                    checked={formData.showEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, showEmail: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* GitHub Visibility */}
            {currentUser.githubId && (
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Label htmlFor="showGithub" className="text-sm font-medium cursor-pointer">
                      Show GitHub Profile Link
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Display a link to your GitHub profile on your public profile
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setFormData(prev => ({ ...prev, showGithub: !prev.showGithub }))}
                  >
                    {formData.showGithub ? (
                      <Eye size={16} className="text-green-600" />
                    ) : (
                      <EyeOff size={16} className="text-muted-foreground" />
                    )}
                  </Button>
                  <input
                    id="showGithub"
                    type="checkbox"
                    checked={formData.showGithub}
                    onChange={(e) => setFormData(prev => ({ ...prev, showGithub: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Social Links Visibility */}
            <div className="flex items-center justify-between py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="showSocialLinks" className="text-sm font-medium cursor-pointer">
                    Show Social Media Links
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Display your Twitter, LinkedIn, Bluesky, and other social links on your public profile
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setFormData(prev => ({ ...prev, showSocialLinks: !prev.showSocialLinks }))}
                >
                  {formData.showSocialLinks ? (
                    <Eye size={16} className="text-green-600" />
                  ) : (
                    <EyeOff size={16} className="text-muted-foreground" />
                  )}
                </Button>
                <input
                  id="showSocialLinks"
                  type="checkbox"
                  checked={formData.showSocialLinks}
                  onChange={(e) => setFormData(prev => ({ ...prev, showSocialLinks: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full md:w-auto">
              {saving ? 'Saving...' : 'Save Privacy Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell size={18} />
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Manage your email and on-site notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Notification settings will be available soon</p>
              <span className="inline-block px-2.5 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-medium">
                Coming Soon
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Settings size={18} />
            Account Actions
          </CardTitle>
          <CardDescription className="text-xs">
            Manage your account settings and security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Separator />
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 h-9"
            >
              <LogOut size={14} />
              Log Out
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 h-9"
            >
              <Trash2 size={14} />
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
