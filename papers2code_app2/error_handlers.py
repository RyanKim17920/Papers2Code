import logging
from functools import wraps
from fastapi import HTTPException, status

from .services.exceptions import (
    PaperNotFoundException,
    AlreadyVotedException,
    VoteProcessingException,
    InvalidActionException,
    UserActionException,
    ServiceException,
    DatabaseOperationException,
    NotFoundException,
    UserNotContributorException,
    InvalidRequestException,
)

logger = logging.getLogger(__name__)

# Mapping of service exceptions to HTTP status codes
EXCEPTION_STATUS_MAP = {
    PaperNotFoundException: status.HTTP_404_NOT_FOUND,
    NotFoundException: status.HTTP_404_NOT_FOUND,
    AlreadyVotedException: status.HTTP_409_CONFLICT,
    InvalidActionException: status.HTTP_400_BAD_REQUEST,
    InvalidRequestException: status.HTTP_400_BAD_REQUEST,
    UserActionException: status.HTTP_400_BAD_REQUEST,
    UserNotContributorException: status.HTTP_403_FORBIDDEN,
    VoteProcessingException: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DatabaseOperationException: status.HTTP_500_INTERNAL_SERVER_ERROR,
    ServiceException: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


def handle_service_errors(func):
    """Decorator to translate service layer exceptions into HTTPException."""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:  # pylint: disable=broad-except
            for exc_cls, status_code in EXCEPTION_STATUS_MAP.items():
                if isinstance(exc, exc_cls):
                    logger.debug("Service exception %s mapped to status %s", exc_cls.__name__, status_code)
                    raise HTTPException(status_code=status_code, detail=str(exc)) from exc
            raise

    return wrapper
