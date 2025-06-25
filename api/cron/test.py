"""
Test endpoint to verify cron job functionality
"""

import json
from datetime import datetime, timezone

def handler(request):
    """Simple test endpoint"""
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
        },
        'body': json.dumps({
            'message': 'Cron job test endpoint working!',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'method': getattr(request, 'method', 'UNKNOWN'),
            'headers': dict(getattr(request, 'headers', {}))
        }, indent=2)
    }

# For Vercel
def main(request):
    return handler(request)
