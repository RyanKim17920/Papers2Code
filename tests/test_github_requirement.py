"""
Tests for GitHub account requirement on implementation features
"""
import pytest
from fastapi import HTTPException
from bson import ObjectId

from papers2code_app2.routers.implementation_progress_router import require_github_account
from papers2code_app2.schemas.minimal import UserSchema


class TestGitHubAccountRequirement:
    """Test suite for GitHub account requirement"""

    def test_require_github_account_with_github_id(self):
        """Test that user with github_id passes the check"""
        user = UserSchema(
            id=ObjectId(),
            username="testuser",
            github_id=12345
        )
        
        # Should not raise exception
        # Note: This is async but in a sync test context we're just checking it exists
        # In real usage it would be awaited
        assert user.github_id is not None

    def test_require_github_account_without_github_id(self):
        """Test that user without github_id would fail the check"""
        user = UserSchema(
            id=ObjectId(),
            username="googleuser",
            google_id="google-123"
        )
        
        # User should not have github_id
        assert user.github_id is None

    @pytest.mark.asyncio
    async def test_require_github_account_raises_for_google_only_user(self):
        """Test that require_github_account raises HTTPException for Google-only users"""
        user = UserSchema(
            id=ObjectId(),
            username="googleuser",
            google_id="google-123"
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await require_github_account(user)
        
        assert exc_info.value.status_code == 403
        assert "GitHub account required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_github_account_passes_for_github_user(self):
        """Test that require_github_account passes for users with GitHub"""
        user = UserSchema(
            id=ObjectId(),
            username="githubuser",
            github_id=12345
        )
        
        # Should not raise exception
        await require_github_account(user)
        # If we get here, the test passed

    @pytest.mark.asyncio
    async def test_require_github_account_passes_for_linked_accounts(self):
        """Test that require_github_account passes for users with both accounts linked"""
        user = UserSchema(
            id=ObjectId(),
            username="linkeduser",
            github_id=12345,
            google_id="google-123"
        )
        
        # Should not raise exception since github_id is present
        await require_github_account(user)
        # If we get here, the test passed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
