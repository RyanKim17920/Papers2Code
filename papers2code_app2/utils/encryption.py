"""
Encryption utilities for sensitive data storage.
"""
import logging
import os
from cryptography.fernet import Fernet
from typing import Optional

logger = logging.getLogger(__name__)


class TokenEncryption:
    """Handle encryption and decryption of sensitive tokens."""
    
    def __init__(self):
        """Initialize encryption with key from environment."""
        encryption_key = os.getenv("TOKEN_ENCRYPTION_KEY")
        
        if not encryption_key:
            logger.warning(
                "TOKEN_ENCRYPTION_KEY not set. Token encryption disabled. "
                "Generate a key with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
            self.cipher = None
        else:
            try:
                self.cipher = Fernet(encryption_key.encode())
            except Exception as e:
                logger.error(f"Failed to initialize encryption cipher: {e}")
                self.cipher = None
    
    def encrypt_token(self, token: str) -> str:
        """
        Encrypt a token for secure storage.
        
        Args:
            token: Plain text token
            
        Returns:
            Encrypted token as string, or original token if encryption unavailable
        """
        if not token:
            return token
            
        if self.cipher is None:
            logger.warning("Token encryption not available, storing token in plaintext")
            return token
        
        try:
            encrypted = self.cipher.encrypt(token.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Token encryption failed: {e}")
            return token
    
    def decrypt_token(self, encrypted_token: str) -> Optional[str]:
        """
        Decrypt a token for use.
        
        Args:
            encrypted_token: Encrypted token string
            
        Returns:
            Decrypted token, or None if decryption fails
        """
        if not encrypted_token:
            return None
            
        if self.cipher is None:
            # If cipher not available, assume token is plaintext (backward compatibility)
            return encrypted_token
        
        try:
            # Try to decrypt (encrypted token)
            decrypted = self.cipher.decrypt(encrypted_token.encode())
            return decrypted.decode()
        except Exception:
            # If decryption fails, might be plaintext token (backward compatibility)
            # Try to use it directly
            logger.warning("Token decryption failed, attempting to use as plaintext")
            return encrypted_token


# Singleton instance
_token_encryption = None

def get_token_encryption() -> TokenEncryption:
    """Get singleton instance of TokenEncryption."""
    global _token_encryption
    if _token_encryption is None:
        _token_encryption = TokenEncryption()
    return _token_encryption
