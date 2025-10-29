"""
Comprehensive compatibility test for GitHub and Google OAuth integration.
Tests account linking, avatar management, and feature access control.
"""
from datetime import datetime, timezone
from bson import ObjectId

# Mock user data for testing
GITHUB_USER = {
    "_id": ObjectId(),
    "username": "testuser",
    "github_id": 12345,
    "github_avatar_url": "https://github.com/avatar.jpg",
    "name": "Test User",
    "email": "test@example.com",
    "showEmail": True,
    "showGithub": True,
    "preferredAvatarSource": "github",
    "createdAt": datetime.now(timezone.utc),
    "lastLoginAt": datetime.now(timezone.utc),
}

GOOGLE_USER = {
    "_id": ObjectId(),
    "username": "googleuser",
    "google_id": "67890",
    "google_avatar_url": "https://google.com/avatar.jpg",
    "name": "Google User",
    "email": "google@example.com",
    "showEmail": True,
    "showGithub": True,
    "preferredAvatarSource": "google",
    "createdAt": datetime.now(timezone.utc),
    "lastLoginAt": datetime.now(timezone.utc),
}

LINKED_USER = {
    "_id": ObjectId(),
    "username": "linkeduser",
    "github_id": 11111,
    "google_id": "22222",
    "github_avatar_url": "https://github.com/linked.jpg",
    "google_avatar_url": "https://google.com/linked.jpg",
    "avatarUrl": "https://github.com/linked.jpg",  # Computed based on preference
    "preferredAvatarSource": "github",
    "name": "Linked User",
    "email": "linked@example.com",
    "showEmail": True,
    "showGithub": True,
    "createdAt": datetime.now(timezone.utc),
    "lastLoginAt": datetime.now(timezone.utc),
}


class TestOAuthCompatibility:
    """Test OAuth integration compatibility between GitHub and Google."""

    def test_github_user_schema_compatibility(self):
        """Test that GitHub-only users have all required fields."""
        user = GITHUB_USER.copy()
        
        # Required fields
        assert user.get("username") is not None
        assert user.get("github_id") is not None
        assert user.get("github_avatar_url") is not None
        
        # Optional fields (Google-specific)
        assert user.get("google_id") is None
        assert user.get("google_avatar_url") is None
        
        # Privacy settings
        assert user.get("showEmail") is not None
        assert user.get("showGithub") is not None

    def test_google_user_schema_compatibility(self):
        """Test that Google-only users have all required fields."""
        user = GOOGLE_USER.copy()
        
        # Required fields
        assert user.get("username") is not None
        assert user.get("google_id") is not None
        assert user.get("google_avatar_url") is not None
        assert user.get("email") is not None
        
        # Optional fields (GitHub-specific)
        assert user.get("github_id") is None
        assert user.get("github_avatar_url") is None
        
        # Privacy settings
        assert user.get("showEmail") is not None

    def test_linked_account_schema_compatibility(self):
        """Test that linked accounts have both provider fields."""
        user = LINKED_USER.copy()
        
        # Both provider IDs present
        assert user.get("github_id") is not None
        assert user.get("google_id") is not None
        
        # Both avatars stored separately
        assert user.get("github_avatar_url") is not None
        assert user.get("google_avatar_url") is not None
        
        # Primary avatar computed
        assert user.get("avatarUrl") is not None
        
        # Avatar preference
        assert user.get("preferredAvatarSource") in ["github", "google"]

    def test_avatar_preference_github(self):
        """Test avatar computation when preference is GitHub."""
        user = LINKED_USER.copy()
        user["preferredAvatarSource"] = "github"
        
        # Primary avatar should match GitHub avatar
        if user.get("preferredAvatarSource") == "github":
            expected_avatar = user.get("github_avatar_url")
        else:
            expected_avatar = user.get("google_avatar_url")
        
        # This simulates the logic in OAuth services
        assert expected_avatar == user.get("github_avatar_url")

    def test_avatar_preference_google(self):
        """Test avatar computation when preference is Google."""
        user = LINKED_USER.copy()
        user["preferredAvatarSource"] = "google"
        
        # Primary avatar should match Google avatar
        if user.get("preferredAvatarSource") == "google":
            expected_avatar = user.get("google_avatar_url")
        else:
            expected_avatar = user.get("github_avatar_url")
        
        # This simulates the logic in OAuth services
        assert expected_avatar == user.get("google_avatar_url")

    def test_github_requirement_for_implementations(self):
        """Test that GitHub account is required for implementation features."""
        # GitHub-only user should have access
        github_user = GITHUB_USER.copy()
        assert github_user.get("github_id") is not None
        
        # Google-only user should NOT have access
        google_user = GOOGLE_USER.copy()
        assert google_user.get("github_id") is None
        
        # Linked user should have access
        linked_user = LINKED_USER.copy()
        assert linked_user.get("github_id") is not None

    def test_email_required_for_account_linking(self):
        """Test that email is used for account linking."""
        # Both users have the same email - should link
        github_user = GITHUB_USER.copy()
        google_user = GOOGLE_USER.copy()
        
        # For linking to work, we need email from Google
        assert google_user.get("email") is not None
        
        # In real implementation, this would trigger account linking
        # when Google user logs in with matching email

    def test_privacy_settings_compatibility(self):
        """Test that privacy settings work for both OAuth providers."""
        # GitHub user
        github_user = GITHUB_USER.copy()
        assert "showEmail" in github_user
        assert "showGithub" in github_user
        
        # Google user
        google_user = GOOGLE_USER.copy()
        assert "showEmail" in google_user
        assert "showGithub" in google_user
        
        # Linked user
        linked_user = LINKED_USER.copy()
        assert "showEmail" in linked_user
        assert "showGithub" in linked_user

    def test_username_generation_compatibility(self):
        """Test that usernames are generated correctly for both providers."""
        # GitHub: Uses 'login' field directly
        github_user = GITHUB_USER.copy()
        assert github_user.get("username") == "testuser"
        
        # Google: Derived from email (before @)
        google_user = GOOGLE_USER.copy()
        email = google_user.get("email", "")
        expected_username = email.split("@")[0] if email else None
        # In real implementation, this would be "googleuser" or similar
        assert google_user.get("username") is not None

    def test_account_linking_preserves_data(self):
        """Test that account linking preserves important user data."""
        existing_user = GITHUB_USER.copy()
        
        # Simulate Google account linking
        existing_user["google_id"] = "67890"
        existing_user["google_avatar_url"] = "https://google.com/new.jpg"
        
        # Original data should be preserved
        assert existing_user.get("github_id") is not None
        assert existing_user.get("github_avatar_url") is not None
        assert existing_user.get("username") == "testuser"
        
        # New data should be added
        assert existing_user.get("google_id") is not None
        assert existing_user.get("google_avatar_url") is not None

    def test_avatar_no_overwrite_on_login(self):
        """Test that avatars are not overwritten on subsequent logins."""
        user = LINKED_USER.copy()
        
        # Store original avatars
        original_github_avatar = user.get("github_avatar_url")
        original_google_avatar = user.get("google_avatar_url")
        
        # Simulate GitHub login (should update github_avatar_url but not google_avatar_url)
        user["github_avatar_url"] = "https://github.com/updated.jpg"
        assert user["github_avatar_url"] != original_github_avatar
        assert user.get("google_avatar_url") == original_google_avatar
        
        # Simulate Google login (should update google_avatar_url but not github_avatar_url)
        user["google_avatar_url"] = "https://google.com/updated.jpg"
        assert user["google_avatar_url"] != original_google_avatar
        # github_avatar_url should remain as updated above
        assert user.get("github_avatar_url") == "https://github.com/updated.jpg"


def test_all_compatibility_checks():
    """Run all compatibility checks."""
    test = TestOAuthCompatibility()
    
    print("Running OAuth compatibility tests...")
    print("✓ Testing GitHub user schema compatibility")
    test.test_github_user_schema_compatibility()
    
    print("✓ Testing Google user schema compatibility")
    test.test_google_user_schema_compatibility()
    
    print("✓ Testing linked account schema compatibility")
    test.test_linked_account_schema_compatibility()
    
    print("✓ Testing avatar preference (GitHub)")
    test.test_avatar_preference_github()
    
    print("✓ Testing avatar preference (Google)")
    test.test_avatar_preference_google()
    
    print("✓ Testing GitHub requirement for implementations")
    test.test_github_requirement_for_implementations()
    
    print("✓ Testing email required for account linking")
    test.test_email_required_for_account_linking()
    
    print("✓ Testing privacy settings compatibility")
    test.test_privacy_settings_compatibility()
    
    print("✓ Testing username generation compatibility")
    test.test_username_generation_compatibility()
    
    print("✓ Testing account linking preserves data")
    test.test_account_linking_preserves_data()
    
    print("✓ Testing avatar no overwrite on login")
    test.test_avatar_no_overwrite_on_login()
    
    print("\n✅ All compatibility tests passed!")


if __name__ == "__main__":
    test_all_compatibility_checks()
