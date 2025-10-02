"""
Utility helpers for handling snake_case <-> camelCase DB fields.

This module provides a tiny compatibility layer so scripts can accept
incoming records that use either `pwc_url` or `pwcUrl` (and similar keys)
without forcing an immediate DB migration.

Functions:
- snake_to_camel(obj): shallowly converts dict keys from snake_case to camelCase.
- get_pwc_url(record): returns the pwc url from either 'pwcUrl' or 'pwc_url'.
"""
from __future__ import annotations

from typing import Any, Dict
import re

_SNAKE_RE = re.compile(r"_([a-z])")


def snake_to_camel(obj: Dict[str, Any]) -> Dict[str, Any]:
    """Shallowly convert top-level dict keys from snake_case to camelCase.

    Leaves non-dict objects untouched.
    """
    if not isinstance(obj, dict):
        return obj
    out: Dict[str, Any] = {}
    for k, v in obj.items():
        if "_" in k:
            new_k = _SNAKE_RE.sub(lambda m: m.group(1).upper(), k)
        else:
            new_k = k
        out[new_k] = v
    return out


def get_pwc_url(record: Dict[str, Any]) -> Any:
    """Return the paper web client URL from a record, supporting both keys."""
    if not isinstance(record, dict):
        return None
    return record.get("pwcUrl") or record.get("pwc_url") or record.get("paper_url")
