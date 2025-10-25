import React, { useState, useEffect } from 'react';
import { Typography, Button, Divider, TextField, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../common/services/auth';
import { updateUserProfile, deleteUserAccount, UserProfileResponse, getUserProfileSettings } from '../common/services/api';
import { 
  normalizeLinkedInUrl, 
  normalizeTwitterUrl, 
  normalizeWebsiteUrl,
  normalizeBlueskyHandle, 
  normalizeHuggingFaceUsername,
  convertDisplayToApiValue,
  type NormalizedUrlResult
} from '../common/utils/urlNormalization';
import ConfirmationModal from '../common/components/ConfirmationModal';

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

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<UserProfileFormData>({
    name: '',
    bio: '',
    websiteUrl: '',
    twitterProfileUrl: '',
    linkedinProfileUrl: '',
    blueskyUsername: '',
    huggingfaceUsername: '',
  });

  // Track field validation states
  const [fieldValidation, setFieldValidation] = useState<Record<string, FieldValidation>>({});

  // Load current user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await getUserProfileSettings();
        if (!data) {
          navigate('/'); // Redirect if not logged in
          return;
        }
        setProfileData(data);
        const user = data.userDetails;
        console.log('Current user:', user);
        setFormData({
          name: user.name || '',
          bio: user.bio || '',
          websiteUrl: normalizeWebsiteUrl(user.websiteUrl || '').displayValue,
          twitterProfileUrl: normalizeTwitterUrl(user.twitterProfileUrl || '').displayValue,
          linkedinProfileUrl: normalizeLinkedInUrl(user.linkedinProfileUrl || '').displayValue,
          blueskyUsername: normalizeBlueskyHandle(user.blueskyUsername || '').displayValue,
          huggingfaceUsername: normalizeHuggingFaceUsername(user.huggingfaceUsername || '').displayValue,
        });
      } catch (err) {
        console.error('Failed to load user data:', err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, [navigate]);

  const handleInputChange = (field: keyof UserProfileFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    
    // Only validate, don't change the display value while typing
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
        // Clear validation for non-social fields
        setFieldValidation(prev => ({
          ...prev,
          [field]: { isValid: true }
        }));
        break;
    }
    
    // Store the actual user input, don't modify it
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear messages when user starts typing
    if (error) setError(null);
    if (successMessage) setSuccessMessage(null);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    // Check if all fields are valid before submitting
    const hasValidationErrors = Object.values(fieldValidation).some(
      validation => validation.isValid === false
    );
    
    if (hasValidationErrors) {
      setError('Please fix the validation errors before submitting.');
      setSaving(false);
      return;
    }

    try {
      // Convert display values to API values (including empty strings to clear fields)
      const cleanedFormData = Object.fromEntries(
        Object.entries(formData)
          .map(([key, value]) => [key, convertDisplayToApiValue(key, value)])
      );
      
      const updatedUser = await updateUserProfile(cleanedFormData);
      setProfileData(prev => prev ? { ...prev, userDetails: updatedUser } : null);
      
      // Update form data with normalized values from the updated user
      const user = updatedUser;
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        websiteUrl: normalizeWebsiteUrl(user.websiteUrl || '').displayValue,
        twitterProfileUrl: normalizeTwitterUrl(user.twitterProfileUrl || '').displayValue,
        linkedinProfileUrl: normalizeLinkedInUrl(user.linkedinProfileUrl || '').displayValue,
        blueskyUsername: normalizeBlueskyHandle(user.blueskyUsername || '').displayValue,
        huggingfaceUsername: normalizeHuggingFaceUsername(user.huggingfaceUsername || '').displayValue,
      });
      
      setSuccessMessage('Profile updated successfully!');
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    localStorage.removeItem('csrfToken');
    navigate('/papers');
    window.location.reload(); // Force reload to clear all state
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      alert('Account deleted successfully.');
      await handleLogout();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setError(error.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-120px)] w-full relative overflow-x-hidden before:content-[''] before:fixed before:inset-0 before:w-full before:h-full before:pointer-events-none before:opacity-30 before:bg-[radial-gradient(var(--gradient-accent)_1px,transparent_1px),radial-gradient(var(--gradient-accent)_1px,transparent_1px)] before:bg-[length:40px_40px] before:bg-[0_0,20px_20px] before:z-[-1] after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-[200px] after:bg-gradient-to-b after:from-[rgba(25,124,154,0.03)] after:to-[rgba(25,124,154,0)] after:z-[-1] after:pointer-events-none">
        <div className="max-w-[var(--content-max-width)] mx-auto px-9 py-10 w-full box-border">
          <div className="loading-state">
            <CircularProgress size={40} className="loading-spinner" />
            <Typography variant="body1" className="loading-text">
              Loading settings...
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-[calc(100vh-120px)] w-full relative overflow-x-hidden before:content-[''] before:fixed before:inset-0 before:w-full before:h-full before:pointer-events-none before:opacity-30 before:bg-[radial-gradient(var(--gradient-accent)_1px,transparent_1px),radial-gradient(var(--gradient-accent)_1px,transparent_1px)] before:bg-[length:40px_40px] before:bg-[0_0,20px_20px] before:z-[-1] after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-[200px] after:bg-gradient-to-b after:from-[rgba(25,124,154,0.03)] after:to-[rgba(25,124,154,0)] after:z-[-1] after:pointer-events-none">
        <div className="max-w-[var(--content-max-width)] mx-auto px-9 py-10 w-full box-border">
          <div className="px-4 py-3 mb-5 bg-[var(--danger-light-color)] border border-[var(--danger-color)] rounded-lg text-[var(--danger-text-color)] text-sm">
            You must be logged in to access settings.
          </div>
        </div>
      </div>
    );
  }

  const currentUser = profileData.userDetails;

  return (
    <div className="min-h-[calc(100vh-120px)] w-full relative overflow-x-hidden before:content-[''] before:fixed before:inset-0 before:w-full before:h-full before:pointer-events-none before:opacity-30 before:bg-[radial-gradient(var(--gradient-accent)_1px,transparent_1px),radial-gradient(var(--gradient-accent)_1px,transparent_1px)] before:bg-[length:40px_40px] before:bg-[0_0,20px_20px] before:z-[-1] after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-[200px] after:bg-gradient-to-b after:from-[rgba(25,124,154,0.03)] after:to-[rgba(25,124,154,0)] after:z-[-1] after:pointer-events-none">
      <div className="max-w-[var(--content-max-width)] mx-auto px-9 py-10 w-full box-border">
        {/* Page Header */}
        <div className="mb-10 text-left">
          <Typography variant="h4" component="h1" className="settings-title">
            Settings
          </Typography>
          <Typography variant="body1" className="settings-subtitle">
            Manage your account preferences and profile information
          </Typography>
        </div>

        {/* Profile Information Section */}
        <div className="space-y-6"> 
          <div className="settings-section-header">
            <Typography variant="h6" component="h2" className="settings-section-title">
              Profile Information
            </Typography>
          </div>
          
          {/* GitHub-managed info */}
          <div className="github-info-card">
            <div className="github-info-header">
              <Typography variant="subtitle2" className="github-info-label">
                GitHub Account (Managed externally)
              </Typography>
            </div>
            <div className="github-info-content">
              <Typography variant="body2" className="github-username">
                <strong>Username:</strong> {currentUser.username}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                className="btn-github-edit"
                href="https://github.com/settings/profile"
                target="_blank"
                rel="noopener noreferrer"
              >
                Edit Username & Avatar on GitHub
              </Button>
            </div>
          </div>

          {/* Editable profile form */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="form-grid">
              <div className="form-field">
                <TextField
                  label="Display Name"
                  value={formData.name}
                  onChange={handleInputChange('name')}
                  placeholder="Your display name"
                  helperText="This will be shown instead of your GitHub username where applicable"
                  fullWidth
                  variant="outlined"
                  className="w-full px-4 py-3 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border border-[var(--border-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-70 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
                />
              </div>
              
              <div className="form-field form-field-full">
                <TextField
                  label="Bio"
                  value={formData.bio}
                  onChange={handleInputChange('bio')}
                  placeholder="Tell use about yourself..."
                  multiline
                  rows={3}
                  helperText="A short description about yourself and your interests"
                  fullWidth
                  variant="outlined"
                  className="w-full px-4 py-3 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border border-[var(--border-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-70 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
                />
              </div>
              
              <div className="form-field">
                <TextField
                  label="Website URL"
                  value={formData.websiteUrl}
                  onChange={handleInputChange('websiteUrl')}
                  placeholder="example.com"
                  helperText={
                    fieldValidation.websiteUrl?.errorMessage || 
                    "Your personal website or portfolio"
                  }
                  error={fieldValidation.websiteUrl?.isValid === false}
                  fullWidth
                  variant="outlined"
                  className="w-full px-4 py-3 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border border-[var(--border-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-70 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
                />
              </div>
              
              <div className="form-field">
                <TextField
                  label="Twitter Profile"
                  value={formData.twitterProfileUrl}
                  onChange={handleInputChange('twitterProfileUrl')}
                  placeholder="username or https://twitter.com/username"
                  helperText={
                    fieldValidation.twitterProfileUrl?.errorMessage || 
                    "Enter your Twitter/X username or URL (shows username only)"
                  }
                  error={fieldValidation.twitterProfileUrl?.isValid === false}
                  fullWidth
                  variant="outlined"
                  className="w-full px-4 py-3 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border border-[var(--border-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-70 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
                />
              </div>
              
              <div className="form-field">
                <TextField
                  label="LinkedIn Profile"
                  value={formData.linkedinProfileUrl}
                  onChange={handleInputChange('linkedinProfileUrl')}
                  placeholder="john-smith or https://linkedin.com/in/john-smith"
                  helperText={
                    fieldValidation.linkedinProfileUrl?.errorMessage || 
                    "Enter your LinkedIn username or URL (shows username only)"
                  }
                  error={fieldValidation.linkedinProfileUrl?.isValid === false}
                  fullWidth
                  variant="outlined"
                  className="w-full px-4 py-3 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border border-[var(--border-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-70 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
                />
              </div>
              
              <div className="form-field">
                <TextField
                  label="Bluesky Handle"
                  value={formData.blueskyUsername}
                  onChange={handleInputChange('blueskyUsername')}
                  placeholder="username.bsky.social or https://bsky.app/profile/username.bsky.social"
                  helperText={
                    fieldValidation.blueskyUsername?.errorMessage || 
                    "Enter your Bluesky handle or full URL"
                  }
                  error={fieldValidation.blueskyUsername?.isValid === false}
                  fullWidth
                  variant="outlined"
                  className="w-full px-4 py-3 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border border-[var(--border-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-70 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
                />
              </div>
              
              <div className="form-field">
                <TextField
                  label="Hugging Face Username"
                  value={formData.huggingfaceUsername}
                  onChange={handleInputChange('huggingfaceUsername')}
                  placeholder="username or https://huggingface.co/username"
                  helperText={
                    fieldValidation.huggingfaceUsername?.errorMessage || 
                    "Enter your Hugging Face username or full URL"
                  }
                  error={fieldValidation.huggingfaceUsername?.isValid === false}
                  fullWidth
                  variant="outlined"
                  className="w-full px-4 py-3 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border border-[var(--border-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-70 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
                />
              </div>
            </div>

            {/* Alert Messages */}
            {error && (
              <div className="px-4 py-3 mb-5 bg-[var(--danger-light-color)] border border-[var(--danger-color)] rounded-lg text-[var(--danger-text-color)] text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="px-4 py-3 mb-5 bg-[var(--success-light-color)] border border-[var(--success-color)] rounded-lg text-[var(--success-dark-color)] text-sm">
                {successMessage}
              </div>
            )}

            {/* Save Button */}
            <div className="form-actions">
              <Button
                type="submit"
                variant="contained"
                className="btn-save-profile"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : null}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </div>

        {/* Notification Preferences Section */}
        <div className="bg-[var(--card-background-color)] rounded-xl shadow-[var(--box-shadow-md)] border border-[var(--border-color)] p-8 mb-8">
          <div className="settings-section-header">
            <Typography variant="h6" component="h2" className="settings-section-title">
              Notification Preferences
            </Typography>
          </div>
          <div className="coming-soon-notice">
            <Typography variant="body1" className="coming-soon-text">
              Manage your email and on-site notification preferences here.
            </Typography>
            <div className="coming-soon-badge">Coming Soon</div>
          </div>
        </div>

        {/* Account Actions Section */}
        <div className="bg-[var(--card-background-color)] rounded-xl shadow-[var(--box-shadow-md)] border-2 border-[var(--danger-color)] p-8 mb-8">
          <div className="settings-section-header">
            <Typography variant="h6" component="h2" className="settings-section-title danger-title">
              Account Actions
            </Typography>
          </div>
          <Divider className="danger-divider" />
          
          <div className="account-actions">
            <div className="account-action">
              <Button 
                variant="outlined" 
                className="btn-logout"
                onClick={handleLogout}
              >
                Log Out
              </Button>
            </div>
            
            <div className="account-action">
              <Button
                variant="outlined"
                color="error"
                onClick={handleDeleteAccount}
                className="btn-delete-account"
              >
                🗑️ Delete My Account
              </Button>
              <Typography variant="caption" display="block" className="action-description">
                Permanently remove your account and all associated data. This action cannot be undone.
              </Typography>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Account"
        confirmText="Delete My Account"
        cancelText="Cancel"
        confirmButtonClass="button-danger"
        isConfirming={isDeleting}
      >
        <p>Are you sure you want to delete your account? This action is irreversible and will remove all your personal data. Your contributions may be anonymized.</p>
        <p><strong>This cannot be undone.</strong></p>
      </ConfirmationModal>
    </div>
  );
};

export default SettingsPage;