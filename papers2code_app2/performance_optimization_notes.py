# Performance optimization suggestions for paper_view_service.py

"""
Key optimizations for MongoDB Atlas Search aggregation:

1. **Reduce Score Threshold**: Lower the score threshold from 3.0 to 1.5-2.0
   - Current: {"$match": {"score": {"$gt": 3.0}}}
   - Suggested: {"$match": {"score": {"$gt": 1.5}}}

2. **Limit Early in Pipeline**: Add limit before score filtering
   - Add: {"$limit": skip + limit * 3}  # Get 3x what we need
   - This reduces documents processed in later stages

3. **Optimize Field Selection**: Only fetch needed fields
   - Add after search: {"$project": {"title": 1, "abstract": 1, "publicationDate": 1, ...}}

4. **Use allowDiskUse for Large Results**:
   - papers_collection.aggregate(pipeline, allowDiskUse=True)

5. **Parallel Processing for Transforms**:
   - Use asyncio.gather() with batches instead of processing all papers sequentially

6. **Database Connection Pooling**:
   - Increase MongoDB connection pool size
   - Use connection per request pattern

7. **Index Optimization**:
   - Create compound indexes for common filter combinations
   - Example: {status: 1, publicationDate: -1, score: 1}

8. **Caching Strategy**:
   - Cache search results for 1-5 minutes
   - Use Redis with search parameters as key
   - Cache popular searches longer

9. **Pagination Optimization**:
   - For large skip values, use cursor-based pagination
   - Store last document's sort field value

10. **Atlas Search Index Tuning**:
    - Use more specific analyzers
    - Disable unnecessary features like highlighting for faster searches
    - Create separate indexes for different search patterns
"""

# Example optimized pipeline structure:
OPTIMIZED_PIPELINE_EXAMPLE = [
    # 1. Atlas Search (with filters in compound query)
    {
        "$search": {
            "index": "papers_optimized", 
            "compound": {
                "must": [{"text": {"query": "search_term", "path": ["title", "abstract"]}}],
                "filter": [
                    {"term": {"query": "status_value", "path": "status"}},
                    {"range": {"path": "publicationDate", "gte": "date_start"}}
                ]
            }
        }
    },
    # 2. Add score field
    {"$addFields": {"score": {"$meta": "searchScore"}}},
    # 3. Early limit (before expensive operations)
    {"$limit": 100},  # Limit early to reduce processing
    # 4. Score filter
    {"$match": {"score": {"$gt": 1.5}}},  # Lower threshold
    # 5. Project only needed fields
    {"$project": {
        "title": 1, "abstract": 1, "authors": 1, "publicationDate": 1,
        "status": 1, "upvoteCount": 1, "score": 1
    }},
    # 6. Sort
    {"$sort": {"score": -1, "publicationDate": -1}},
    # 7. Facet for pagination
    {"$facet": {
        "paginatedResults": [{"$skip": 0}, {"$limit": 12}],
        "totalCount": [{"$count": "count"}]
    }}
]
