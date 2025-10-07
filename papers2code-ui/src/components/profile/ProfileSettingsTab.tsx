import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Trash2, Globe, Twitter, Linkedin, User, FileText, Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { logoutUser } from '../../common/services/auth';
import { updateUserProfile, deleteUserAccount } from '../../common/services/api';
import { useToast } from '../../common/hooks/use-toast';
import { 
  normalizeLinkedInUrl, 
  normalizeTwitterUrl, 
  normalizeWebsiteUrl,
  normalizeBlueskyHandle, 
  normalizeHuggingFaceUsername,
  convertDisplayToApiValue,
  type NormalizedUrlResult
} from '../../common/utils/urlNormalization';
import ConfirmationModal from '../../common/components/ConfirmationModal';

interface UserProfileFormData {
  name: string;
  bio: string;
  websiteUrl: string;
  twitterProfileUrl: string;
  linkedinProfileUrl: string;
  blueskyUsername: string;
  huggingfaceUsername: string;
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
    <div className="space-y-6 max-w-4xl">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User size={20} />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your public profile information and social links
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* GitHub info */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm font-medium mb-2">GitHub Account (Managed externally)</p>
            <p className="text-sm text-muted-foreground mb-3">
              <strong>Username:</strong> {currentUser.username}
            </p>
            <Button
              variant="outline"
              size="sm"
              asChild
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

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Your display name"
                />
                <p className="text-xs text-muted-foreground">
                  This will be shown instead of your GitHub username
                </p>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  A short description about yourself and your interests
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <Globe size={14} />
                  Website URL
                </Label>
                <Input
                  id="website"
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  placeholder="example.com"
                  className={fieldValidation.websiteUrl?.isValid === false ? 'border-destructive' : ''}
                />
                <p className={`text-xs ${fieldValidation.websiteUrl?.isValid === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {fieldValidation.websiteUrl?.errorMessage || 'Your personal website or portfolio'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="twitter" className="flex items-center gap-2">
                  <Twitter size={14} />
                  Twitter Profile
                </Label>
                <Input
                  id="twitter"
                  value={formData.twitterProfileUrl}
                  onChange={(e) => handleInputChange('twitterProfileUrl', e.target.value)}
                  placeholder="username or https://twitter.com/username"
                  className={fieldValidation.twitterProfileUrl?.isValid === false ? 'border-destructive' : ''}
                />
                <p className={`text-xs ${fieldValidation.twitterProfileUrl?.isValid === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {fieldValidation.twitterProfileUrl?.errorMessage || 'Enter your Twitter/X username or URL'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="linkedin" className="flex items-center gap-2">
                  <Linkedin size={14} />
                  LinkedIn Profile
                </Label>
                <Input
                  id="linkedin"
                  value={formData.linkedinProfileUrl}
                  onChange={(e) => handleInputChange('linkedinProfileUrl', e.target.value)}
                  placeholder="john-smith or https://linkedin.com/in/john-smith"
                  className={fieldValidation.linkedinProfileUrl?.isValid === false ? 'border-destructive' : ''}
                />
                <p className={`text-xs ${fieldValidation.linkedinProfileUrl?.isValid === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {fieldValidation.linkedinProfileUrl?.errorMessage || 'Enter your LinkedIn username or URL'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bluesky">Bluesky Handle</Label>
                <Input
                  id="bluesky"
                  value={formData.blueskyUsername}
                  onChange={(e) => handleInputChange('blueskyUsername', e.target.value)}
                  placeholder="username.bsky.social"
                  className={fieldValidation.blueskyUsername?.isValid === false ? 'border-destructive' : ''}
                />
                <p className={`text-xs ${fieldValidation.blueskyUsername?.isValid === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {fieldValidation.blueskyUsername?.errorMessage || 'Enter your Bluesky handle or full URL'}
                </p>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="huggingface">Hugging Face Username</Label>
                <Input
                  id="huggingface"
                  value={formData.huggingfaceUsername}
                  onChange={(e) => handleInputChange('huggingfaceUsername', e.target.value)}
                  placeholder="username or https://huggingface.co/username"
                  className={fieldValidation.huggingfaceUsername?.isValid === false ? 'border-destructive' : ''}
                />
                <p className={`text-xs ${fieldValidation.huggingfaceUsername?.isValid === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {fieldValidation.huggingfaceUsername?.errorMessage || 'Enter your Hugging Face username or full URL'}
                </p>
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full md:w-auto">
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Manage your email and on-site notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-center">
            <div>
              <p className="text-muted-foreground mb-2">Notification settings will be available soon</p>
              <span className="inline-block px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full font-medium">
                Coming Soon
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Settings size={20} />
            Account Actions
          </CardTitle>
          <CardDescription>
            Manage your account settings and security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut size={16} />
              Log Out
            </Button>
            
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              className="flex items-center gap-2"
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
