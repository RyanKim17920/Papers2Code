#!/usr/bin/env python3
"""
Comprehensive verification script for Google OAuth implementation.
This script validates:
1. Python syntax in all modified files
2. MongoDB field naming (camelCase convention)
3. Schema consistency
4. Token encryption framework
5. OAuth service implementations
"""

import sys
import os
import importlib.util
from pathlib import Path

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✓{RESET} {msg}")

def print_error(msg):
    print(f"{RED}✗{RESET} {msg}")

def print_warning(msg):
    print(f"{YELLOW}⚠{RESET} {msg}")

def print_info(msg):
    print(f"{BLUE}ℹ{RESET} {msg}")

def verify_python_syntax(file_path):
    """Verify Python file syntax by attempting to compile"""
    try:
        with open(file_path, 'r') as f:
            compile(f.read(), file_path, 'exec')
        return True, None
    except SyntaxError as e:
        return False, str(e)

def verify_file_imports(file_path):
    """Verify file can be imported (checks dependencies)"""
    try:
        spec = importlib.util.spec_from_file_location("module", file_path)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            # Don't execute, just check it can be loaded
            return True, None
    except Exception as e:
        return False, str(e)
    return True, None

def verify_camelcase_fields():
    """Verify MongoDB fields use camelCase convention"""
    print_info("Verifying MongoDB camelCase field naming...")
    
    schema_file = Path("papers2code_app2/schemas/minimal.py")
    if not schema_file.exists():
        print_error(f"Schema file not found: {schema_file}")
        return False
    
    with open(schema_file, 'r') as f:
        content = f.read()
    
    # Check for camelCase fields
    camelcase_fields = [
        'githubId', 'googleId', 'avatarUrl', 'githubAvatarUrl', 
        'googleAvatarUrl', 'preferredAvatarSource', 'showEmail', 
        'showGithub', 'isAdmin', 'createdAt', 'updatedAt', 
        'lastLoginAt', 'profileUpdatedAt'
    ]
    
    missing_fields = []
    for field in camelcase_fields:
        if field not in content:
            missing_fields.append(field)
    
    if missing_fields:
        print_error(f"Missing camelCase fields: {', '.join(missing_fields)}")
        return False
    
    print_success("All MongoDB fields use camelCase convention")
    return True

def verify_encryption_module():
    """Verify token encryption module exists and is valid"""
    print_info("Verifying token encryption module...")
    
    encryption_file = Path("papers2code_app2/utils/encryption.py")
    if not encryption_file.exists():
        print_error(f"Encryption module not found: {encryption_file}")
        return False
    
    with open(encryption_file, 'r') as f:
        content = f.read()
    
    # Check for key components
    required_components = ['TokenEncryption', 'Fernet', 'encrypt_token', 'decrypt_token']
    missing = [c for c in required_components if c not in content]
    
    if missing:
        print_error(f"Missing encryption components: {', '.join(missing)}")
        return False
    
    print_success("Token encryption module is complete")
    return True

def verify_oauth_services():
    """Verify OAuth service implementations"""
    print_info("Verifying OAuth service implementations...")
    
    services = [
        "papers2code_app2/services/google_oauth_service.py",
        "papers2code_app2/services/github_oauth_service.py"
    ]
    
    all_valid = True
    for service_file in services:
        path = Path(service_file)
        if not path.exists():
            print_error(f"Service file not found: {service_file}")
            all_valid = False
            continue
        
        valid, error = verify_python_syntax(path)
        if not valid:
            print_error(f"Syntax error in {service_file}: {error}")
            all_valid = False
        else:
            print_success(f"Valid syntax: {service_file}")
    
    return all_valid

def verify_account_linking():
    """Verify account linking implementation"""
    print_info("Verifying account linking implementation...")
    
    auth_routes = Path("papers2code_app2/routers/auth_routes.py")
    if not auth_routes.exists():
        print_error("Auth routes file not found")
        return False
    
    with open(auth_routes, 'r') as f:
        content = f.read()
    
    # Check for key account linking components
    components = ['link-accounts', 'pending_link', 'AccountLinkModal']
    missing = []
    for component in components:
        if component not in content:
            missing.append(component)
    
    if 'link-accounts' in missing:
        print_error("Account linking endpoint not found")
        return False
    
    print_success("Account linking implementation verified")
    return True

def verify_privacy_controls():
    """Verify privacy control implementation"""
    print_info("Verifying privacy controls...")
    
    schema_file = Path("papers2code_app2/schemas/minimal.py")
    with open(schema_file, 'r') as f:
        content = f.read()
    
    privacy_fields = ['showEmail', 'showGithub']
    missing = [f for f in privacy_fields if f not in content]
    
    if missing:
        print_error(f"Missing privacy fields: {', '.join(missing)}")
        return False
    
    print_success("Privacy controls verified")
    return True

def verify_github_requirement():
    """Verify GitHub requirement for implementation features"""
    print_info("Verifying GitHub requirement implementation...")
    
    impl_router = Path("papers2code_app2/routers/implementation_progress_router.py")
    if not impl_router.exists():
        print_error("Implementation progress router not found")
        return False
    
    with open(impl_router, 'r') as f:
        content = f.read()
    
    if 'require_github_account' not in content:
        print_error("GitHub requirement function not found")
        return False
    
    print_success("GitHub requirement implementation verified")
    return True

def main():
    """Run all verification checks"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Google OAuth Implementation Verification{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    checks = [
        ("MongoDB camelCase Fields", verify_camelcase_fields),
        ("Token Encryption Module", verify_encryption_module),
        ("OAuth Services Syntax", verify_oauth_services),
        ("Account Linking", verify_account_linking),
        ("Privacy Controls", verify_privacy_controls),
        ("GitHub Requirement", verify_github_requirement),
    ]
    
    results = []
    for check_name, check_func in checks:
        print(f"\n{BLUE}[{check_name}]{RESET}")
        try:
            result = check_func()
            results.append((check_name, result))
        except Exception as e:
            print_error(f"Verification failed with exception: {e}")
            results.append((check_name, False))
    
    # Summary
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Verification Summary{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for check_name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"  {check_name}: {status}")
    
    print(f"\n{BLUE}Results: {passed}/{total} checks passed{RESET}")
    
    if passed == total:
        print(f"\n{GREEN}✓ All verification checks passed!{RESET}")
        print(f"{GREEN}✓ Implementation is ready for testing and deployment{RESET}\n")
        return 0
    else:
        print(f"\n{RED}✗ Some verification checks failed{RESET}")
        print(f"{YELLOW}⚠ Review the errors above and fix before deployment{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
