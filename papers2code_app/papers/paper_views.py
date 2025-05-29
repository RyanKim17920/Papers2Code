from flask import jsonify, request, session
from . import papers_bp # Import the blueprint instance
from ..extensions import limiter, mongo
from ..models import transform_paper, get_papers_collection
from ..config import Config

from pymongo import DESCENDING, ASCENDING
from pymongo.errors import OperationFailure
from bson import ObjectId
from bson.errors import InvalidId
from dateutil.parser import parse as parse_date
from dateutil.parser._parser import ParserError
import traceback
import shlex

# --- API Endpoints ---

@papers_bp.route('', methods=['GET'])
@limiter.limit("100 per minute")
def get_papers():
    try:
        # --- Parameter Parsing ---
        limit_str = request.args.get('limit', '12')
        page_str = request.args.get('page', '1')
        search_term = request.args.get('search', '').strip()
        sort_param = request.args.get('sort', 'newest').lower()
        start_date_str = request.args.get('startDate', None)
        end_date_str = request.args.get('endDate', None)
        search_authors = request.args.get('searchAuthors', '').strip()

        # --- Validation ---
        try:
            limit = int(limit_str)
            if limit <= 0: limit = 12
        except ValueError:
            return jsonify({"error": "Invalid limit parameter"}), 400

        try:
            page = int(page_str)
            if page < 1: page = 1
        except ValueError:
            return jsonify({"error": "Invalid page parameter"}), 400

        # --- Parse Dates ---
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = parse_date(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0)
            if end_date_str:
                end_date = parse_date(end_date_str).replace(hour=23, minute=59, second=59, microsecond=999999)
        except ParserError:
            return jsonify({"error": "Invalid date format. Please use YYYY-MM-DD or similar."}), 400

        skip = (page - 1) * limit
        papers_cursor = None
        total_count = 0
        current_user_id = session.get('user', {}).get('id')
        papers_collection = get_papers_collection()

        # --- Determine if Search or Advanced Filter is Active ---
        is_search_active = bool(search_term or start_date or end_date or search_authors)

        # --- Atlas Search Path ---
        if is_search_active:
            print(f"Executing Search/Filter with: Term='{search_term}', Start='{start_date}', End='{end_date}', Authors='{search_authors}'")

            # --- Atlas Search Pipeline ---
            atlas_search_index_name = "default" # Or get from config if needed
            score_threshold = 3 # Or get from config if needed
            overall_limit = 2400 # Or get from config if needed

            # --- Build Search Clauses ---
            must_clauses = []
            should_clauses = []
            filter_clauses = []

            # 1. Main Search Term (Title/Abstract)
            if search_term:
                try:
                    terms = shlex.split(search_term)
                    print(f"Split terms for main search: {terms}")
                except ValueError:
                    terms = search_term.split()
                    print(f"Warning: shlex split failed for main search, using simple split: {terms}")

                must_clauses.extend([
                    {
                        "text": {
                            "query": t,
                            "path": ["title", "abstract"],
                            "fuzzy": {"maxEdits": 1, "prefixLength": 1}
                        }
                    } for t in terms
                ])
                should_clauses.append({
                    "text": {
                        "query": search_term,
                        "path": "title",
                        "score": {"boost": {"value": 3}} # Boost value from config?
                    }
                })

            # 2. Date Range Filter
            date_range_query = {}
            if start_date: date_range_query["gte"] = start_date
            if end_date: date_range_query["lte"] = end_date
            if date_range_query:
                filter_clauses.append({"range": {"path": "publication_date", **date_range_query}})

            # 3. Author Filter
            if search_authors:
                 filter_clauses.append({"text": {"query": search_authors, "path": "authors"}})

            # --- Construct the $search stage ---
            search_operator = {"index": atlas_search_index_name, "compound": {}}
            if must_clauses: search_operator["compound"]["must"] = must_clauses
            if should_clauses: search_operator["compound"]["should"] = should_clauses
            if filter_clauses: search_operator["compound"]["filter"] = filter_clauses

            # Handle case where only filters are provided
            if not must_clauses and not should_clauses and not filter_clauses:
                 is_search_active = False # Fallback to non-search if criteria somehow empty
            elif not must_clauses and not should_clauses:
                 search_operator["compound"].pop("must", None)
                 search_operator["compound"].pop("should", None)
                 # If only filters, ensure compound isn't empty
                 if not filter_clauses: is_search_active = False # Fallback

            # --- Build Full Pipeline (Only if search is active) ---
            if is_search_active:
                print(f"Executing Atlas Search with sort: '{sort_param}'")
                search_pipeline_stages = [{"$search": search_operator}]
                if search_term: # Only add score/highlight if text search was performed
                    search_pipeline_stages.extend([
                        {"$addFields": {"score": {"$meta": "searchScore"}, "highlights": {"$meta": "searchHighlights"}}},
                        {"$match": {"score": {"$gt": score_threshold}}}
                    ])
                    # Atlas search results are typically sorted by score relevance
                    sort_stage = {"$sort": {"score": DESCENDING, "publication_date": DESCENDING}}
                else: # Sort by date if only filters were used
                    sort_stage = {"$sort": {"publication_date": DESCENDING}}
                search_pipeline_stages.append(sort_stage)
                search_pipeline_stages.append({"$limit": overall_limit})

                facet_pipeline = search_pipeline_stages + [
                    {"$facet": {
                        "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                        "totalCount": [{"$count": 'count'}]
                    }}
                ]

                # --- Execute Aggregation ---
                try:
                    print("Executing Atlas Search $facet pipeline...")
                    results = list(papers_collection.aggregate(facet_pipeline, allowDiskUse=True))
                    if results and results[0]:
                        total_count = results[0]['totalCount'][0]['count'] if results[0]['totalCount'] else 0
                        papers_cursor = results[0]['paginatedResults']
                        print(f"Atlas Search returned {len(papers_cursor)} papers for page {page}, total found: {total_count}")
                    else:
                        print("Atlas Search returned no results.")
                        papers_cursor = []
                        total_count = 0
                except OperationFailure as op_error:
                     print(f"Atlas Search OperationFailure: {op_error.details}")
                     traceback.print_exc()
                     return jsonify({"error": "Search operation failed"}), 500
                except Exception as agg_error:
                    print(f"Error during Atlas Search aggregation: {agg_error}")
                    traceback.print_exc()
                    return jsonify({"error": "Failed to execute search query"}), 500
            # --- End Atlas Search Path ---

        # --- Non-search / Default Path ---
        if not is_search_active:
            print(f"Executing standard FIND with sort: '{sort_param}' and default non-implementable filter.")
            # Default filter: Exclude papers confirmed non-implementable
            base_filter = {
                "nonImplementableStatus": {"$ne": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB}
            }

            if sort_param == 'oldest':
                sort_criteria = [("publication_date", ASCENDING)]
            elif sort_param == 'upvotes':
                sort_criteria = [("upvoteCount", DESCENDING), ("publication_date", DESCENDING)]
            else: # Default to newest
                sort_criteria = [("publication_date", DESCENDING)]

            try:
                # Apply the base_filter to count and find
                total_count = papers_collection.count_documents(base_filter)
                print(f"Total documents (default view count): {total_count}")
                if total_count > 0:
                     papers_cursor = papers_collection.find(base_filter).sort(sort_criteria).skip(skip).limit(limit)
                else:
                     papers_cursor = []
            except Exception as find_error:
                 print(f"Error during non-search find/count: {find_error}")
                 traceback.print_exc()
                 return jsonify({"error": "Failed to retrieve paper data"}), 500
            # --- End Non-search logic ---

        # --- Process Results & Return ---
        total_count = int(total_count)
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        papers_list = [transform_paper(paper, current_user_id) for paper in papers_cursor] if papers_cursor else []

        return jsonify({"papers": papers_list, "totalPages": total_pages})

    except Exception as e:
        print(f"General Error in GET /api/papers: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred"}), 500


@papers_bp.route('/<string:paper_id>', methods=['GET'])
@limiter.limit("100 per minute")
def get_paper_by_id(paper_id):
    try:
        try: obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper ID format"}), 400

        papers_collection = get_papers_collection()
        paper_doc = papers_collection.find_one({"_id": obj_id})
        if paper_doc:
            current_user_id = session.get('user', {}).get('id')
            return jsonify(transform_paper(paper_doc, current_user_id))
        else: return jsonify({"error": "Paper not found"}), 404
    except Exception as e:
        print(f"Error in GET /api/papers/{paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred"}), 500
