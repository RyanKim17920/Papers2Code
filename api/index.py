"""
Vercel Serverless Function Entry Point

This file adapts your FastAPI app to work with Vercel's serverless functions.
"""

import sys
import os
from mangum import Mangum

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import your FastAPI app
try:
    from papers2code_app2.main import app
    
    # Create the Mangum handler for Vercel
    handler = Mangum(app, lifespan="off")
    
except ImportError as e:
    print(f"Import error: {e}")
    
    # Fallback minimal app if imports fail
    from fastapi import FastAPI
    
    fallback_app = FastAPI()
    
    @fallback_app.get("/")
    async def root():
        return {"error": "Import failed", "message": str(e)}
    
    handler = Mangum(fallback_app, lifespan="off")
