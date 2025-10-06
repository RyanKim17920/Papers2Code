#!/usr/bin/env python3
"""
Migration script to convert old implementation progress schema to new timeline-based schema.

This script:
1. Reads all implementation progress documents from the database
2. Converts them to the new schema with timeline events
3. Updates the documents in place

Old schema:
{
    "_id": ObjectId (paper_id),
    "initiatedBy": ObjectId,
    "contributors": [ObjectId],
    "emailStatus": str,
    "emailSentAt": datetime | null,
    "githubRepoId": str | null,
    "createdAt": datetime,
    "updatedAt": datetime
}

New schema:
{
    "_id": ObjectId (paper_id),
    "initiatedBy": ObjectId,
    "contributors": [ObjectId],
    "status": str,
    "latestUpdate": datetime,
    "githubRepoId": str | null,
    "updates": [
        {
            "eventType": str,
            "timestamp": datetime,
            "userId": ObjectId | null,
            "details": dict
        }
    ],
    "createdAt": datetime,
    "updatedAt": datetime
}
"""

import sys
import os
from datetime import datetime, timezone
from typing import List, Dict, Any

# Add parent directory to path to import from papers2code_app2
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from bson import ObjectId

# Import settings to get database connection
from papers2code_app2.database import get_mongo_uri_and_db_name


# Mapping from old EmailStatus to new ProgressStatus
STATUS_MAPPING = {
    "Not Sent": "Started",
    "Sent": "Started",
    "Response Received": "Response Received",
    "Code Uploaded": "Code Uploaded",
    "Code Needs Refactoring": "Code Needs Refactoring",
    "Refactoring in Progress": "Refactoring in Progress",
    "Refused to Upload": "Refused to Upload",
    "No Response": "No Response",
}


def convert_progress_to_new_schema(old_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert an old implementation progress document to new schema."""
    
    # Build the updates timeline
    updates = []
    
    # 1. Always start with an "Initiated" event
    initiated_event = {
        "eventType": "Initiated",
        "timestamp": old_doc.get("createdAt", datetime.now(timezone.utc)),
        "userId": old_doc.get("initiatedBy"),
        "details": {}
    }
    updates.append(initiated_event)
    
    # 2. If there are additional contributors (beyond initiator), add join events
    initiator_id = old_doc.get("initiatedBy")
    contributors = old_doc.get("contributors", [])
    for contributor_id in contributors:
        if contributor_id != initiator_id:
            join_event = {
                "eventType": "Contributor Joined",
                "timestamp": old_doc.get("createdAt", datetime.now(timezone.utc)),
                "userId": contributor_id,
                "details": {}
            }
            updates.append(join_event)
    
    # 3. If email was sent, add Email Sent event
    email_sent_at = old_doc.get("emailSentAt")
    if email_sent_at:
        email_event = {
            "eventType": "Email Sent",
            "timestamp": email_sent_at,
            "userId": initiator_id,
            "details": {}
        }
        updates.append(email_event)
    
    # 4. If status changed from initial state, add Status Changed event
    old_status = old_doc.get("emailStatus", "Not Sent")
    new_status = STATUS_MAPPING.get(old_status, "Started")
    
    # Only add status change if it's not the initial "Started" status or if email was sent
    if old_status not in ["Not Sent", "Sent"] and new_status != "Started":
        status_event = {
            "eventType": "Status Changed",
            "timestamp": old_doc.get("updatedAt", datetime.now(timezone.utc)),
            "userId": initiator_id,
            "details": {
                "previousStatus": "Started",
                "newStatus": new_status
            }
        }
        updates.append(status_event)
    
    # 5. If GitHub repo exists, add GitHub Repo Linked event
    github_repo_id = old_doc.get("githubRepoId")
    if github_repo_id:
        repo_event = {
            "eventType": "GitHub Repo Linked",
            "timestamp": old_doc.get("updatedAt", datetime.now(timezone.utc)),
            "userId": initiator_id,
            "details": {
                "githubRepoId": github_repo_id
            }
        }
        updates.append(repo_event)
    
    # Build the new document
    new_doc = {
        "_id": old_doc["_id"],
        "initiatedBy": old_doc.get("initiatedBy"),
        "contributors": old_doc.get("contributors", []),
        "status": new_status,
        "latestUpdate": old_doc.get("updatedAt", datetime.now(timezone.utc)),
        "githubRepoId": github_repo_id,
        "updates": updates,
        "createdAt": old_doc.get("createdAt", datetime.now(timezone.utc)),
        "updatedAt": old_doc.get("updatedAt", datetime.now(timezone.utc))
    }
    
    return new_doc


def migrate_implementation_progress(dry_run: bool = True):
    """Migrate all implementation progress documents."""
    
    # Get database connection
    mongo_uri, db_name = get_mongo_uri_and_db_name()
    client = MongoClient(mongo_uri)
    db = client[db_name]
    collection = db["implementationProgress"]
    
    print(f"Connected to database: {db_name}")
    print(f"Collection: implementationProgress")
    print(f"Dry run: {dry_run}")
    print()
    
    # Get all documents
    old_docs = list(collection.find())
    print(f"Found {len(old_docs)} documents to migrate")
    print()
    
    if len(old_docs) == 0:
        print("No documents to migrate")
        return
    
    # Convert each document
    migrated_count = 0
    error_count = 0
    
    for i, old_doc in enumerate(old_docs, 1):
        try:
            paper_id = old_doc["_id"]
            print(f"[{i}/{len(old_docs)}] Migrating document for paper: {paper_id}")
            
            # Convert to new schema
            new_doc = convert_progress_to_new_schema(old_doc)
            
            # Show the changes
            print(f"  Old status: {old_doc.get('emailStatus', 'Not Sent')}")
            print(f"  New status: {new_doc['status']}")
            print(f"  Number of events: {len(new_doc['updates'])}")
            
            if not dry_run:
                # Replace the document
                result = collection.replace_one(
                    {"_id": paper_id},
                    new_doc
                )
                if result.modified_count > 0:
                    print(f"  ✓ Successfully updated")
                    migrated_count += 1
                else:
                    print(f"  ⚠ No changes made")
            else:
                print(f"  (Dry run - no changes made)")
                migrated_count += 1
            
            print()
            
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            error_count += 1
            print()
    
    print(f"\n{'='*60}")
    print(f"Migration {'simulation' if dry_run else 'complete'}")
    print(f"Total documents: {len(old_docs)}")
    print(f"Successfully migrated: {migrated_count}")
    print(f"Errors: {error_count}")
    print(f"{'='*60}\n")
    
    client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate implementation progress to new schema")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually perform the migration (default is dry run)"
    )
    
    args = parser.parse_args()
    
    if args.execute:
        response = input("This will modify the database. Are you sure? (yes/no): ")
        if response.lower() != "yes":
            print("Migration cancelled")
            sys.exit(0)
    
    migrate_implementation_progress(dry_run=not args.execute)
