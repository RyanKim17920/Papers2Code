import json
import hashlib
import os
from typing import Any, Optional, Dict, List
import logging
from datetime import datetime, timedelta

from .shared import config_settings

logger = logging.getLogger(__name__)

class InMemoryCache:
    """Simple in-memory cache as fallback when Redis is not available"""
    def __init__(self):
        self._cache = {}
        self._expiry = {}
    
    def get(self, key: str) -> Optional[str]:
        if key in self._cache and key in self._expiry:
            if datetime.now() < self._expiry[key]:
                return self._cache[key]
            else:
                # Expired
                del self._cache[key]
                del self._expiry[key]
        return None
    
    def setex(self, key: str, ttl: int, value: str):
        self._cache[key] = value
        self._expiry[key] = datetime.now() + timedelta(seconds=ttl)
    
    def ping(self):
        return True

class PaperSearchCache:
    def __init__(self):
        if not config_settings.ENABLE_CACHE:
            logger.info("Caching disabled via config")
            self.redis_client = InMemoryCache()
            return
            
        try:
            # Try Redis first if available
            import redis
            if config_settings.REDIS_URL:
                self.redis_client = redis.from_url(config_settings.REDIS_URL)
                self.redis_client.ping()  # Test connection
                logger.info("Redis cache initialized successfully")
            else:
                raise ImportError("No Redis URL provided in config")
        except (ImportError, Exception) as e:
            logger.info(f"Redis not available ({e}), using in-memory cache")
            self.redis_client = InMemoryCache()

    def _generate_cache_key(self, **kwargs) -> str:
        """Generate a cache key from search parameters"""
        # Sort parameters for consistent keys
        sorted_params = sorted(kwargs.items())
        key_string = json.dumps(sorted_params, sort_keys=True)
        return f"papers_search:{hashlib.md5(key_string.encode()).hexdigest()}"

    async def get_cached_result(self, **search_params) -> Optional[Dict[str, Any]]:
        """Get cached search result"""
        try:
            cache_key = self._generate_cache_key(**search_params)
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                logger.info(f"Cache hit for key: {cache_key}")
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Cache retrieval error: {e}")
        return None

    async def cache_result(self, result: Dict[str, Any], **search_params) -> None:
        """Cache search result"""
        try:
            cache_key = self._generate_cache_key(**search_params)
            # Use TTL from config
            ttl = config_settings.CACHE_TTL
            self.redis_client.setex(
                cache_key, 
                ttl, 
                json.dumps(result, default=str)
            )
            logger.info(f"Cached result for key: {cache_key} with TTL: {ttl}s")
        except Exception as e:
            logger.error(f"Cache storage error: {e}")

# Global cache instance
paper_cache = PaperSearchCache()
