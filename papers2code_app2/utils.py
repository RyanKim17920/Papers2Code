"""
DEPRECATED: This file is deprecated and kept only for backward compatibility.

All transformation utilities have been moved to:
- papers2code_app2/utils/transformations.py (implementation)
- papers2code_app2/utils/__init__.py (re-exports)

Please import from `papers2code_app2.utils` package instead:
    from papers2code_app2.utils import transform_papers_batch

This file will be removed in a future version.
"""

# Re-export from the new location for backward compatibility
from .utils import (
    transform_papers_batch,
    _transform_authors,
    _transform_url,
)

__all__ = [
    'transform_papers_batch',
    '_transform_authors',
    '_transform_url',
]
