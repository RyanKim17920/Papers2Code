class ServiceException(Exception):
    """Base class for service layer exceptions."""
    def __init__(self, message="A service error occurred"):
        self.message = message
        super().__init__(self.message)

class PaperNotFoundException(ServiceException):
    def __init__(self, paper_id: str):
        super().__init__(message=f"Paper with ID '{paper_id}' not found.")
        self.paper_id = paper_id

class UserActionException(ServiceException):
    """Base for user action related errors."""
    pass

class AlreadyVotedException(UserActionException):
    def __init__(self, paper_id: str, user_id: str, vote_type: str):
        super().__init__(message=f"User '{user_id}' has already performed action '{vote_type}' on paper '{paper_id}'.")

class VoteProcessingException(UserActionException):
    def __init__(self, message="Failed to process vote action."):
        super().__init__(message=message)

class InvalidActionException(UserActionException):
    def __init__(self, message="Invalid action specified."):
        super().__init__(message=message)

class AuthenticationException(ServiceException):
    """Base class for authentication related errors."""
    def __init__(self, message="Authentication failed."):
        super().__init__(message)

class InvalidTokenException(AuthenticationException):
    """Raised when a token is invalid, expired, or malformed."""
    def __init__(self, detail="Invalid or expired token."):
        super().__init__(message=detail)

class UserNotFoundException(ServiceException):
    """Raised when a user is not found."""
    def __init__(self, user_identifier: str | None = None, criteria: str = "identifier"):
        if user_identifier:
            super().__init__(message=f"User with {criteria} '{user_identifier}' not found.")
        else:
            super().__init__(message="User not found.")
        self.user_identifier = user_identifier

class OAuthException(AuthenticationException):
    """Base class for OAuth related errors."""
    def __init__(self, message="OAuth process failed.", detail: str | None = None):
        super().__init__(message=detail or message)

class OAuthStateMissingException(OAuthException):
    def __init__(self, detail="OAuth state cookie not found."):
        super().__init__(detail=detail)

class OAuthStateMismatchException(OAuthException):
    def __init__(self, detail="OAuth state mismatch."):
        super().__init__(detail=detail)

class GitHubTokenExchangeException(OAuthException):
    def __init__(self, detail="Failed to exchange code for GitHub token."):
        super().__init__(detail=detail)

class GitHubUserDataException(OAuthException):
    def __init__(self, detail="Failed to fetch user data from GitHub."):
        super().__init__(detail=detail)

class DatabaseOperationException(ServiceException):
    """Raised when a database operation fails."""
    def __init__(self, detail="A database operation failed."):
        super().__init__(message=detail)
