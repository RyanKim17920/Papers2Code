from fastapi import Depends
from slowapi import Limiter
from slowapi.util import get_remote_address

from .services.paper_view_service import PaperViewService
from .services.paper_action_service import PaperActionService
from .services.paper_moderation_service import PaperModerationService
from .services.implementation_progress_service import ImplementationProgressService
from .services.user_service import UserService

limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])


def get_paper_view_service() -> PaperViewService:
    return PaperViewService()


def get_paper_action_service() -> PaperActionService:
    return PaperActionService()


def get_paper_moderation_service() -> PaperModerationService:
    return PaperModerationService()


def get_implementation_progress_service() -> ImplementationProgressService:
    return ImplementationProgressService()


def get_user_service() -> UserService:
    return UserService()