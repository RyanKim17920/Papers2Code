#!/bin/bash
# Initialize Development Database
# Copies MongoDB structure from production and seeds with 500 random papers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  Papers2Code Dev Database Initialization"
echo "=========================================="
echo ""

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.dev" ]; then
    export $(cat "$PROJECT_ROOT/.env.dev" | grep -v '^#' | xargs)
    echo "✓ Loaded .env.dev"
else
    echo "ERROR: .env.dev not found!"
    echo "Run: cp .env.example .env.dev"
    exit 1
fi

# Check required variables
if [ -z "$MONGO_URI_PROD" ]; then
    echo "ERROR: MONGO_URI_PROD not set in .env.dev"
    exit 1
fi

if [ -z "$MONGO_URI_DEV" ]; then
    echo "ERROR: MONGO_URI_DEV not set in .env.dev"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  Production: ${MONGO_URI_PROD%%@*}@***" # Hide credentials
echo "  Development: ${MONGO_URI_DEV%%@*}@***"
echo ""

# Check if we should resample
RESAMPLE=false
if [ "$1" == "--resample" ] || [ "$1" == "-r" ]; then
    RESAMPLE=true
    echo "ℹ️  Resample mode: Will replace existing data"
    echo ""
fi

# Run Python script to copy structure and sample data
cd "$PROJECT_ROOT"

echo "Step 1: Installing dependencies..."
uv pip install pymongo python-dotenv

echo ""
echo "Step 2: Copying database structure and sampling data..."
echo ""

# Create temporary Python script
cat > /tmp/init_dev_db.py << 'PYTHON_SCRIPT'
import os
import sys
import random
from pymongo import MongoClient
from datetime import datetime

# Get environment variables
MONGO_URI_PROD = os.getenv("MONGO_URI_PROD")
MONGO_URI_DEV = os.getenv("MONGO_URI_DEV")
SAMPLE_SIZE = int(os.getenv("SAMPLE_SIZE", "500"))

if not MONGO_URI_PROD or not MONGO_URI_DEV:
    print("ERROR: MongoDB URIs not set")
    sys.exit(1)

print("🔗 Connecting to databases...")

try:
    # Connect to production (read-only)
    prod_client = MongoClient(MONGO_URI_PROD, serverSelectionTimeoutMS=5000)
    prod_db = prod_client.get_database()
    prod_client.admin.command('ping')
    print(f"  ✓ Connected to production: {prod_db.name}")
    
    # Connect to development
    dev_client = MongoClient(MONGO_URI_DEV, serverSelectionTimeoutMS=5000)
    dev_db = dev_client.get_database()
    dev_client.admin.command('ping')
    print(f"  ✓ Connected to development: {dev_db.name}")
    
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

print()
print("📊 Analyzing production database...")

# Get all collections
prod_collections = prod_db.list_collection_names()
print(f"  Found {len(prod_collections)} collections")

print()
print("🔨 Creating structure in dev database...")

for coll_name in prod_collections:
    if coll_name.startswith('system.'):
        continue
    
    # Get collection info
    prod_coll = prod_db[coll_name]
    dev_coll = dev_db[coll_name]
    
    # Get indexes
    indexes = list(prod_coll.list_indexes())
    
    # Drop and recreate collection
    dev_coll.drop()
    
    # Recreate indexes (except _id which is automatic)
    for index in indexes:
        if index['name'] != '_id_':
            keys = list(index['key'].items())
            options = {k: v for k, v in index.items() if k not in ['key', 'v', 'ns']}
            try:
                dev_coll.create_index(keys, **options)
            except Exception as e:
                print(f"    ⚠️  Could not create index {index['name']}: {e}")
    
    print(f"  ✓ Created structure for {coll_name}")

print()
print(f"📄 Sampling {SAMPLE_SIZE} papers from production...")

# Get papers collection
prod_papers = prod_db.papers
dev_papers = dev_db.papers

total_papers = prod_papers.count_documents({})
print(f"  Total papers in production: {total_papers}")

if total_papers == 0:
    print("  ⚠️  No papers in production!")
    sys.exit(0)

# Sample papers
actual_sample = min(SAMPLE_SIZE, total_papers)
print(f"  Sampling {actual_sample} papers...")

try:
    # Use aggregation for random sampling
    sampled_papers = list(prod_papers.aggregate([
        {"$sample": {"size": actual_sample}}
    ]))
except Exception as e:
    print(f"    ⚠️  Aggregation failed, using fallback: {e}")
    all_papers = list(prod_papers.find().limit(actual_sample * 2))
    sampled_papers = random.sample(all_papers, min(actual_sample, len(all_papers)))

if sampled_papers:
    dev_papers.insert_many(sampled_papers)
    print(f"  ✓ Inserted {len(sampled_papers)} papers")
else:
    print("  ⚠️  No papers sampled!")

print()
print("👥 Copying related data...")

# Get IDs of sampled papers
paper_ids = [p['_id'] for p in sampled_papers]
paper_arxiv_ids = [p.get('arxiv_id') for p in sampled_papers if p.get('arxiv_id')]

# Copy user actions related to sampled papers
if 'user_actions' in prod_collections:
    prod_actions = prod_db.user_actions
    dev_actions = dev_db.user_actions
    
    actions = list(prod_actions.find({
        "$or": [
            {"paperId": {"$in": paper_ids}},
            {"arxivId": {"$in": paper_arxiv_ids}}
        ]
    }))
    
    if actions:
        dev_actions.insert_many(actions)
        print(f"  ✓ Copied {len(actions)} user actions")

# Copy implementation progress
if 'implementation_progress' in prod_collections:
    prod_progress = prod_db.implementation_progress
    dev_progress = dev_db.implementation_progress
    
    progress_docs = list(prod_progress.find({
        "$or": [
            {"paperId": {"$in": paper_ids}},
            {"arxivId": {"$in": paper_arxiv_ids}}
        ]
    }))
    
    if progress_docs:
        dev_progress.insert_many(progress_docs)
        print(f"  ✓ Copied {len(progress_docs)} implementation progress records")

# Get user IDs from actions
if actions:
    user_ids = list(set(a.get('userId') for a in actions if a.get('userId')))
    
    # Copy users
    if user_ids and 'users' in prod_collections:
        prod_users = prod_db.users
        dev_users = dev_db.users
        
        users = list(prod_users.find({"_id": {"$in": user_ids}}))
        
        if users:
            dev_users.insert_many(users)
            print(f"  ✓ Copied {len(users)} users")

print()
print("✅ Development database initialized!")
print()
print("Summary:")
print(f"  - {len(sampled_papers)} papers")
print(f"  - {len(actions) if actions else 0} user actions")
print(f"  - {len(progress_docs) if progress_docs else 0} implementation progress")
print(f"  - {len(users) if actions and users else 0} users")
print()
print("Database: " + dev_db.name)

PYTHON_SCRIPT

# Run the Python script
uv run python /tmp/init_dev_db.py

# Cleanup
rm /tmp/init_dev_db.py

echo ""
echo "=========================================="
echo "  ✅ Initialization Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. docker-compose -f docker-compose.dev.yml up -d"
echo "  2. Open http://localhost:5173"
echo ""
