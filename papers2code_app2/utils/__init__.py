# Re-export transformation utilities from the transformations module
# This keeps the package clean - all implementation lives in transformations.py
from .transformations import (
    transform_papers_batch,
    _transform_authors,
    _transform_url,
)

__all__ = [
    'transform_papers_batch',
    '_transform_authors',
    '_transform_url',
]
