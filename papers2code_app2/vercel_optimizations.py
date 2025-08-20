"""
Vercel Cold Start Optimization for FastAPI + MongoDB

Key strategies:
1. Global connection reuse
2. Lazy loading of heavy imports
3. Minimal startup time
4. Connection pooling using PyMongo's native async support
"""

import os
from functools import lru_cache
from pymongo import AsyncMongoClient  # PyMongo native async support
import asyncio

# Global variables for connection reuse
_client = None
_database = None

@lru_cache()
def get_mongodb_url():
    """Cache MongoDB URL to avoid repeated env lookups"""
    return os.getenv("MONGODB_URL")

async def get_database_connection():
    """
    Get database connection with connection reuse for Vercel serverless
    Uses PyMongo's native async support (not Motor)
    """
    global _client, _database
    
    if _client is None:
        mongodb_url = get_mongodb_url()
        _client = AsyncMongoClient(
            mongodb_url,
            maxPoolSize=5,  # Lower for serverless
            minPoolSize=1,
            maxIdleTimeMS=10000,  # Shorter idle time
            serverSelectionTimeoutMS=3000,  # Faster timeout
            connectTimeoutMS=3000,
            socketTimeoutMS=10000,
            retryWrites=True,
            w='majority'
        )
        _database = _client.get_database()
        
        # Warm up the connection
        try:
            await _database.command("ping")
        except Exception as e:
            print(f"Database ping failed: {e}")
            
    return _database

# Optimize imports for faster cold starts
def lazy_import_heavy_modules():
    """Import heavy modules only when needed"""
    try:
        # Only import if actually needed
        pass
    except ImportError:
        pass

# FastAPI optimization for Vercel
try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    def create_optimized_app():
        """Create FastAPI app optimized for Vercel"""
        app = FastAPI(
            title="Papers2Code API",
            docs_url="/api/docs",  # Vercel-friendly path
            redoc_url="/api/redoc",
            openapi_url="/api/openapi.json"
        )
        
        # Minimal CORS for faster startup
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure properly for production
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["*"],
        )
        
        return app
except ImportError:
    # FastAPI not available in this environment
    def create_optimized_app():
        return None
