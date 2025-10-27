# Google OAuth Setup Guide

This guide explains how to set up Google OAuth authentication for Papers2Code.

## Overview

Papers2Code now supports Google OAuth authentication in addition to GitHub OAuth. This allows users to sign in using their Google accounts, providing a more flexible authentication experience.

## Features

- **Dual OAuth Support**: Users can authenticate using either GitHub or Google
- **Account Linking**: If a user signs in with both providers using the same email, the accounts are automatically linked
- **Seamless Experience**: The authentication flow is identical to GitHub OAuth from the user's perspective
- **Secure Token Management**: Uses JWT tokens with secure httpOnly cookies

## Prerequisites

- A Google Cloud Platform (GCP) account
- Access to the Google Cloud Console
- Admin access to your Papers2Code deployment

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top and select "New Project"
3. Enter a project name (e.g., "Papers2Code")
4. Click "Create"

### 2. Enable Google+ API (Optional but recommended)

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click on it and then click "Enable"

### 3. Configure OAuth Consent Screen

1. Navigate to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace organization)
3. Click "Create"
4. Fill in the required information:
   - **App name**: Papers2Code
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click "Save and Continue"
6. On the Scopes page, you don't need to add any additional scopes (the default ones are sufficient)
7. Click "Save and Continue"
8. Add test users if you want to test before publishing (optional)
9. Click "Save and Continue"
10. Review your settings and click "Back to Dashboard"

### 4. Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Configure the settings:
   - **Name**: Papers2Code Web Client
   - **Authorized JavaScript origins**:
     - For development: `http://localhost:5173`
     - For production: `https://your-domain.com`
   - **Authorized redirect URIs**:
     - For development: `http://localhost:5000/api/auth/google/callback`
     - For production: `https://your-api-domain.com/api/auth/google/callback`
5. Click "Create"
6. You'll see a dialog with your Client ID and Client Secret - **save these securely**

### 5. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional: Override default Google OAuth URLs (usually not needed)
# GOOGLE_AUTHORIZE_URL=https://accounts.google.com/o/oauth2/v2/auth
# GOOGLE_ACCESS_TOKEN_URL=https://oauth2.googleapis.com/token
# GOOGLE_API_USER_URL=https://www.googleapis.com/oauth2/v2/userinfo
# GOOGLE_SCOPE=openid email profile
```

### 6. Restart Your Application

After configuring the environment variables, restart your backend:

```bash
# Development
uv run run_app2.py

# Production
# Restart your production server according to your deployment method
```

## Testing the Integration

### 1. Test Login Flow

1. Navigate to your application's frontend
2. Click on the "Sign in with Google" button (you'll need to add this to your frontend)
3. You should be redirected to Google's login page
4. After signing in, you should be redirected back to your application
5. Check that you're logged in and your user profile is populated

### 2. Verify User Creation

1. Check your MongoDB database
2. Look for a new user document with a `google_id` field
3. The user should have:
   - `username`: Derived from email (before @ symbol)
   - `email`: User's Google email
   - `name`: User's Google display name
   - `avatarUrl`: User's Google profile picture
   - `google_id`: Google user ID

### 3. Test Account Linking

1. Create a user via GitHub OAuth
2. Sign out
3. Sign in with Google using the same email address
4. The system should link the accounts automatically
5. The user document should now have both `github_id` and `google_id`

## API Endpoints

The following endpoints are available for Google OAuth:

### Initiate Google Login

```http
GET /api/auth/google/login
```

Redirects the user to Google's OAuth consent screen.

### Google OAuth Callback

```http
GET /api/auth/google/callback?code={auth_code}&state={state}
```

Handles the callback from Google after user authorization. This endpoint:
1. Validates the state parameter
2. Exchanges the authorization code for an access token
3. Fetches user information from Google
4. Creates or updates the user in the database
5. Sets authentication cookies
6. Redirects to the frontend

## Frontend Integration

To add a "Sign in with Google" button to your frontend:

```typescript
// In your login component
const handleGoogleLogin = () => {
  window.location.href = `${API_BASE_URL}/api/auth/google/login`;
};

// Button component
<button onClick={handleGoogleLogin}>
  <GoogleIcon />
  Sign in with Google
</button>
```

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS for OAuth callbacks in production
2. **State Parameter**: The implementation uses a state parameter to prevent CSRF attacks
3. **Secure Cookies**: Authentication cookies are httpOnly and secure in production
4. **Token Expiration**: Access tokens expire after 30 minutes, refresh tokens after 7 days
5. **Client Secret**: Never expose your client secret in client-side code

## Troubleshooting

### "redirect_uri_mismatch" Error

This error occurs when the redirect URI doesn't match what's configured in Google Cloud Console.

**Solution**:
1. Check your Google Cloud Console credentials
2. Ensure the redirect URI exactly matches (including protocol and port)
3. Common issue: using `http://localhost:5173` instead of `http://localhost:5000`

### "invalid_client" Error

This error occurs when the client ID or secret is incorrect.

**Solution**:
1. Verify your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
2. Ensure there are no extra spaces or quotes
3. Regenerate credentials if needed

### User Email Not Available

Some Google accounts may not have a public email address.

**Solution**:
- The implementation handles this by creating a username from the Google ID
- Consider requesting email scope explicitly if needed

### Account Linking Not Working

If accounts aren't linking automatically:

**Solution**:
1. Check that the email addresses match exactly
2. Verify the database query for existing users
3. Check logs for any database errors

## Advanced Configuration

### Custom Scopes

If you need additional Google API access, you can customize the scopes:

```bash
GOOGLE_SCOPE=openid email profile https://www.googleapis.com/auth/calendar.readonly
```

### Username Collision Handling

The implementation automatically handles username collisions by appending numbers:
- First user with email `john@gmail.com` gets username `john`
- Second user with conflicting username gets `john1`, `john2`, etc.

## Production Checklist

Before deploying to production:

- [ ] Configure production redirect URIs in Google Cloud Console
- [ ] Set up HTTPS for your domain
- [ ] Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in production environment
- [ ] Verify `FRONTEND_URL` is set correctly
- [ ] Test the complete OAuth flow in staging environment
- [ ] Enable logging to monitor OAuth errors
- [ ] Consider rate limiting for OAuth endpoints
- [ ] Review OAuth consent screen information for accuracy

## Monitoring and Logging

The Google OAuth service logs important events:

- OAuth initialization
- State validation
- Token exchange
- User creation/updates
- Errors and exceptions

Check your application logs for entries from `GoogleOAuthService`.

## Support

For issues related to:
- **Google OAuth setup**: Refer to [Google OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2)
- **Papers2Code integration**: Check the main README.md or open a GitHub issue
- **Security concerns**: Follow the security policy in .github/SECURITY_POLICY.md

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [FastAPI OAuth Documentation](https://fastapi.tiangolo.com/advanced/security/oauth2/)
- [Papers2Code Security Architecture](../security/SECURITY_ARCHITECTURE.md)
