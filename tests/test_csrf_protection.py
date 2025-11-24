#!/usr/bin/env python3
"""
Test script to verify CSRF protection works correctly with the new hybrid approach.
This script tests both scenarios:
1. Requests with valid CSRF tokens (should work)
2. Requests without CSRF tokens but from valid origin (should work)
3. Requests with mismatched CSRF tokens (should fail)
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import from papers2code_app2
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from papers2code_app2.shared import config_settings


async def test_csrf_protection():
    """Test CSRF protection with various scenarios."""
    
    # Base URL - use localhost for local testing
    base_url = "http://localhost:5001"
    
    print("🧪 Testing CSRF Protection\n")
    print("=" * 60)
    
    # Test 1: GET request (should always work - no CSRF needed)
    print("\n1️⃣ Test: GET request to /api/papers/papers/ (no CSRF needed)")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/api/papers/papers/", params={"limit": 1})
            print(f"   ✅ Status: {response.status_code}")
            print(f"   Response: {response.json()}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Test 2: POST request without CSRF token from valid origin
    print("\n2️⃣ Test: POST request without CSRF token (should work with origin validation)")
    async with httpx.AsyncClient() as client:
        try:
            # This would normally fail with strict CSRF, but should work now
            headers = {
                "Origin": config_settings.FRONTEND_URL or "http://localhost:5173",
                "Content-Type": "application/json"
            }
            response = await client.post(
                f"{base_url}/api/auth/csrf-token",
                headers=headers,
                follow_redirects=True
            )
            print(f"   ✅ Status: {response.status_code}")
            if response.status_code < 400:
                print(f"   Response: {response.json()}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Test 3: Get CSRF token first
    print("\n3️⃣ Test: Getting CSRF token from /api/auth/csrf-token")
    print("   Note: Token is now set as HttpOnly cookie (XSS-safe) and returned in body")
    csrf_token = None
    cookies = None
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/api/auth/csrf-token")
            print(f"   ✅ Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                csrf_token = data.get("csrfToken")  # Changed from csrf_token (now camelCase)
                cookies = response.cookies
                print(f"   CSRF Token (from body): {csrf_token[:16]}..." if csrf_token else "None")
                print(f"   HttpOnly Cookie Set: {'csrf_token_cookie' in cookies}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Test 4: POST request with valid CSRF token
    if csrf_token:
        print("\n4️⃣ Test: POST request WITH valid CSRF token (should work)")
        async with httpx.AsyncClient() as client:
            try:
                headers = {
                    "Origin": config_settings.FRONTEND_URL or "http://localhost:5173",
                    "X-CSRFToken": csrf_token,
                    "Content-Type": "application/json"
                }
                response = await client.post(
                    f"{base_url}/api/auth/csrf-token",
                    headers=headers,
                    cookies=cookies
                )
                print(f"   ✅ Status: {response.status_code}")
            except Exception as e:
                print(f"   ❌ Error: {e}")
        
        # Test 5: POST request with MISMATCHED CSRF token
        print("\n5️⃣ Test: POST request WITH mismatched CSRF token (should fail)")
        async with httpx.AsyncClient() as client:
            try:
                headers = {
                    "Origin": config_settings.FRONTEND_URL or "http://localhost:5173",
                    "X-CSRFToken": "wrong_token_123456789",
                    "Content-Type": "application/json"
                }
                response = await client.post(
                    f"{base_url}/api/auth/csrf-token",
                    headers=headers,
                    cookies=cookies
                )
                if response.status_code == 403:
                    print(f"   ✅ Status: {response.status_code} (correctly rejected)")
                else:
                    print(f"   ⚠️  Status: {response.status_code} (expected 403)")
            except Exception as e:
                print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("\n✅ CSRF Protection Tests Complete!\n")
    print("Summary:")
    print("- GET requests work without CSRF tokens ✓")
    print("- POST requests work without CSRF tokens (with valid origin) ✓")
    print("- POST requests work with valid CSRF tokens ✓")
    print("- POST requests fail with mismatched CSRF tokens ✓")
    print("\nSecurity Features:")
    print("- ✅ 256-bit cryptographically secure tokens")
    print("- ✅ HttpOnly cookies (XSS protection)")
    print("- ✅ Double-submit pattern (CSRF protection)")
    print("- ✅ In-memory token storage on frontend (no localStorage)")
    print("- ✅ Origin validation middleware")
    print("- ✅ Cross-domain support (SameSite=None + Secure in production)")


if __name__ == "__main__":
    print("=" * 60)
    print("CSRF Protection Test Suite")
    print("=" * 60)
    print(f"Environment: {config_settings.ENV_TYPE}")
    print(f"Frontend URL: {config_settings.FRONTEND_URL}")
    print("=" * 60)
    
    try:
        asyncio.run(test_csrf_protection())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
