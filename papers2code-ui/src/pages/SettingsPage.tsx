import React, { useState, useEffect } from 'react';
import { Typography, Button, Divider, TextField, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../common/context/ModalContext';
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
import './SettingsPage.css';

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
  const { showModal, hideModal } = useModal();
  
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
    navigate('/');
    window.location.reload();
  };

  const handleDeleteAccount = () => {
    showModal({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action is irreversible and will remove all your personal data. Your contributions may be anonymized.',
      actions: [
        {
          label: 'Cancel',
          onClick: hideModal,
          color: 'primary',
        },
        {
          label: 'Delete My Account',
          onClick: async () => {
            hideModal();
            try {
              await deleteUserAccount();
              alert('Account deleted successfully.');
              await handleLogout();
            } catch (error: any) {
              console.error('Error deleting account:', error);
              setError(error.message || 'Failed to delete account');
            }
          },
          color: 'error',
          variant: 'contained',
        },
      ],
    });
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-container">
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
      <div className="settings-page">
        <div className="settings-container">
          <div className="settings-alert settings-alert-error">
            You must be logged in to access settings.
          </div>
        </div>
      </div>
    );
  }

  const currentUser = profileData.userDetails;

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* Page Header */}
        <div className="settings-header">
          <Typography variant="h4" component="h1" className="settings-title">
            Settings
          </Typography>
          <Typography variant="body1" className="settings-subtitle">
            Manage your account preferences and profile information
          </Typography>
        </div>

        {/* Profile Information Section */}
        <div className="settings-section-content"> 
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
          <form onSubmit={handleSaveProfile} className="profile-form">
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
                  className="settings-input"
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
                  className="settings-input"
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
                  className="settings-input"
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
                  className="settings-input"
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
                  className="settings-input"
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
                  className="settings-input"
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
                  className="settings-input"
                />
              </div>
            </div>

            {/* Alert Messages */}
            {error && (
              <div className="settings-alert settings-alert-error">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="settings-alert settings-alert-success">
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
        <div className="settings-section">
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
        <div className="settings-section danger-zone">
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
              <div className="danger-warning">
                <strong>Warning:</strong> Deleting your account is permanent and cannot be undone.
              </div>
              <Button 
                variant="contained" 
                className="btn-delete-account"
                onClick={handleDeleteAccount}
              >
                Delete My Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;