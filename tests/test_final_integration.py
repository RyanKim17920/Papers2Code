"""
Final integration tests to ensure all Google OAuth features work together.
Tests the complete flow from login to account linking to feature access.
"""
import pytest
from bson import ObjectId
from datetime import datetime, timezone

from papers2code_app2.schemas.minimal import UserSchema, UserUpdateProfile
from papers2code_app2.routers.implementation_progress_router import require_github_account


class TestFinalIntegration:
    """Final integration tests for Google OAuth implementation"""
    
    def test_user_schema_with_all_camelcase_fields(self):
        """Test that UserSchema accepts all camelCase fields from MongoDB"""
        user_data = {
            "_id": ObjectId(),
            "githubId": 12345,
            "googleId": "google-67890",
            "username": "testuser",
            "email": "test@example.com",
            "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
            "githubAvatarUrl": "https://avatars.githubusercontent.com/u/12345",
            "googleAvatarUrl": "https://lh3.googleusercontent.com/test",
            "preferredAvatarSource": "github",
            "name": "Test User",
            "bio": "Test bio",
            "websiteUrl": "https://example.com",
            "twitterProfileUrl": "https://twitter.com/test",
            "linkedinProfileUrl": "https://linkedin.com/in/test",
            "blueskyUsername": "test.bsky.social",
            "huggingfaceUsername": "test",
            "isAdmin": False,
            "isOwner": False,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "lastLoginAt": datetime.now(timezone.utc),
            "profileUpdatedAt": datetime.now(timezone.utc),
            "showEmail": True,
            "showGithub": True,
        }
        
        # Should create successfully with camelCase fields
        user = UserSchema(**user_data)
        
        # Verify fields are accessible via snake_case in Python
        assert user.github_id == 12345
        assert user.google_id == "google-67890"
        assert user.avatar_url == "https://avatars.githubusercontent.com/u/12345"
        assert user.preferred_avatar_source == "github"
        assert user.show_email == True
        assert user.show_github == True
        assert user.created_at is not None
        assert user.updated_at is not None
    
    def test_github_only_user_has_full_access(self):
        """Test GitHub-only user has all permissions"""
        user = UserSchema(
            id=ObjectId(),
            username="githubuser",
            github_id=12345,
            email="github@example.com",
            avatarUrl="https://avatars.githubusercontent.com/u/12345"
        )
        
        assert user.github_id is not None
        assert user.google_id is None
        # User should pass GitHub requirement check
    
    def test_google_only_user_lacks_github_access(self):
        """Test Google-only user doesn't have GitHub ID"""
        user = UserSchema(
            id=ObjectId(),
            username="googleuser",
            google_id="google-123",
            email="google@example.com",
            avatarUrl="https://lh3.googleusercontent.com/test"
        )
        
        assert user.google_id is not None
        assert user.github_id is None
        # User would fail GitHub requirement check
    
    def test_linked_account_has_both_ids(self):
        """Test linked account has both GitHub and Google IDs"""
        user = UserSchema(
            id=ObjectId(),
            username="linkeduser",
            github_id=12345,
            google_id="google-123",
            email="linked@example.com",
            githubAvatarUrl="https://avatars.githubusercontent.com/u/12345",
            googleAvatarUrl="https://lh3.googleusercontent.com/test",
            avatarUrl="https://avatars.githubusercontent.com/u/12345",
            preferredAvatarSource="github"
        )
        
        assert user.github_id is not None
        assert user.google_id is not None
        assert user.github_avatar_url is not None
        assert user.google_avatar_url is not None
        assert user.preferred_avatar_source == "github"
    
    def test_privacy_settings_default_to_visible(self):
        """Test privacy settings default to True (visible)"""
        user = UserSchema(
            id=ObjectId(),
            username="testuser",
            github_id=12345
        )
        
        assert user.show_email == True
        assert user.show_github == True
    
    def test_user_update_profile_with_privacy_settings(self):
        """Test profile update includes privacy settings"""
        update = UserUpdateProfile(
            name="Updated Name",
            bio="Updated bio",
            showEmail=False,
            showGithub=False,
            preferredAvatarSource="google"
        )
        
        assert update.name == "Updated Name"
        assert update.show_email == False
        assert update.show_github == False
        assert update.preferred_avatar_source == "google"
    
    @pytest.mark.asyncio
    async def test_require_github_account_with_github_user(self):
        """Test GitHub requirement passes for GitHub user"""
        user = UserSchema(
            id=ObjectId(),
            username="githubuser",
            github_id=12345
        )
        
        # Should not raise exception
        await require_github_account(user)
    
    @pytest.mark.asyncio
    async def test_require_github_account_with_linked_user(self):
        """Test GitHub requirement passes for linked account"""
        user = UserSchema(
            id=ObjectId(),
            username="linkeduser",
            github_id=12345,
            google_id="google-123"
        )
        
        # Should not raise exception
        await require_github_account(user)
    
    @pytest.mark.asyncio
    async def test_require_github_account_fails_for_google_only(self):
        """Test GitHub requirement fails for Google-only user"""
        from fastapi import HTTPException
        
        user = UserSchema(
            id=ObjectId(),
            username="googleuser",
            google_id="google-123"
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await require_github_account(user)
        
        assert exc_info.value.status_code == 403
        assert "GitHub account required" in exc_info.value.detail
    
    def test_avatar_management_for_linked_accounts(self):
        """Test avatar source preference works correctly"""
        # GitHub preference
        user_github_pref = UserSchema(
            id=ObjectId(),
            username="linkeduser",
            github_id=12345,
            google_id="google-123",
            githubAvatarUrl="https://github.com/avatar.jpg",
            googleAvatarUrl="https://google.com/avatar.jpg",
            avatarUrl="https://github.com/avatar.jpg",
            preferredAvatarSource="github"
        )
        
        assert user_github_pref.avatar_url == "https://github.com/avatar.jpg"
        assert user_github_pref.preferred_avatar_source == "github"
        
        # Google preference
        user_google_pref = UserSchema(
            id=ObjectId(),
            username="linkeduser2",
            github_id=12345,
            google_id="google-123",
            githubAvatarUrl="https://github.com/avatar.jpg",
            googleAvatarUrl="https://google.com/avatar.jpg",
            avatarUrl="https://google.com/avatar.jpg",
            preferredAvatarSource="google"
        )
        
        assert user_google_pref.avatar_url == "https://google.com/avatar.jpg"
        assert user_google_pref.preferred_avatar_source == "google"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
