import os
import re
import time
import dotenv
from typing import List
from pymongo import MongoClient
import openai
from google import genai # Corrected import for the new API client
from google.genai import types # Import the 'types' module for GenerateContentConfig
from tqdm import tqdm
import sys

"""Automatically label CS papers with an OpenAI or Google GenAI chat model and optionally
remove high‑certainty negatives from the source collection.

Env requirements (set via .env or shell):
  LLM_PROVIDER     – 'openai' or 'gemini' (default: openai)
  OPENAI_API_KEY   – your OpenAI key (if LLM_PROVIDER is openai)
  GOOGLE_API_KEY   – your Google GenAI key (if LLM_PROVIDER is gemini)
  MONGO_URI        – connection string for MongoDB
  DB_NAME          – database name (default: papers2code)
  PAPERS_COLL      – input collection (default: papers)
  WORKING_COLL     – positive label collection (default: working_papers)
  REMOVED_COLL     – negative label collection (default: removed_papers)
  MODEL_NAME       – chat model (default: gpt-4o-mini for openai, gemini-2.0-flash for gemini)
  BATCH_SIZE       – docs per API call (default: 1)
  LIMIT            – max docs to label this run (default: 1000)
  DELETE_THRESHOLD – certainty percentage above which a negative sample is
                     deleted from PAPERS_COLL (default: 80)
"""

dotenv.load_dotenv()

# --- LLM Provider Configuration ---
# Determine which LLM provider to use from environment variable, default to 'openai'.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()

# Initialize API client variables outside the functions for reuse
openai_client = None
gemini_client = None

if LLM_PROVIDER == "openai":
    # Get OpenAI API key and configure client
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not set in environment or .env file for OpenAI provider.")
    openai.api_key = openai_api_key
    # Set default model name for OpenAI
    MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
    # Initialize OpenAI client
    openai_client = openai.chat.completions
elif LLM_PROVIDER == "gemini":
    # Get Google GenAI API key and configure client
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        raise RuntimeError("GOOGLE_API_KEY not set in environment or .env file for Gemini provider.")
    
    # Initialize Gemini client using the correct genai.Client method
    gemini_client = genai.Client(api_key=google_api_key) 
    # Set default model name for Gemini
    MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.0-flash")
else:
    # Raise error for unsupported LLM provider
    raise ValueError(f"Unsupported LLM_PROVIDER: '{LLM_PROVIDER}'. Please set LLM_PROVIDER to 'openai' or 'gemini'.")

# --- MongoDB Configuration ---
MONGO_URI = os.getenv("MONGO_URI_PROD", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "papers2code")
PAPERS_COLL = os.getenv("PAPERS_COLL", "papers")
WORKING_COLL = os.getenv("WORKING_COLL", "working_papers")
REMOVED_COLL = os.getenv("REMOVED_COLL", "removed_papers")

# --- General Run Configuration ---
BATCH_SIZE = int(os.getenv("BATCH_SIZE", 1))
LIMIT = int(os.getenv("LIMIT", 10000))
DELETE_THRESHOLD = float(os.getenv("DELETE_THRESHOLD", 90)) # percentage

# --- Database Connection ---
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
papers = db[PAPERS_COLL]
working = db[WORKING_COLL]
removed = db[REMOVED_COLL]

# --- LLM System Prompt (remains unchanged as it's model-agnostic instructions) ---
SYSTEM_PROMPT = """
Identify computer-science papers that introduce a clearly novel, reusable software-side contribution (method, algorithm, system, or technique).
Use the title and abstract only.

A paper is “yes” if all four bullets below are satisfied.
1. It is CS-focused (AI, ML, data-science, software-eng, etc.).
2. It proposes a NEW or IMPROVED software method/algorithm/system, not just an application or benchmark.
3. The innovation can be re-implemented without proprietary or exotic hardware.
4. The contribution is reusable/extensible by the community.

“No” papers include (but aren’t limited to):
Surveys, dataset or benchmark descriptions, or purely empirical studies with no new software idea.
Works that only apply existing models or tweak hyper-parameters.
Hardware-only or hardware-dependent projects with no general-purpose software method.

“Not sure” rules — be strict: choose “not sure” when ANY of the following is true
The abstract is vague or too short to tell.
The novel contribution is borderline or unclear.
You lack ≥ 80 % confidence after reading.
Output format (exactly): one short rationale (≤ 2 sentences), then on a new line one of
`yes (certainty: X %)`
`no (certainty: X %)`
`not sure (certainty: X %)`   ← include a % here too, e.g. 40 %

Pick X from 0–100 to reflect your confidence.
Be concise and precise.
"""

def chunked(iterable: List[dict], n: int):
    """Yield successive n-sized chunks (tiny helper, avoids external libs)."""
    for i in range(0, len(iterable), n):
        yield iterable[i : i + n]

# Regex to parse the decision and certainty from the LLM's response
DECISION_RE = re.compile(r"^(yes|no|not sure)\b.*", re.I | re.M)  # capture whole line
CERT_RE     = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def fetch_unlabeled(limit: int) -> List[dict]:
    """
    Return up to `limit` unlabeled documents by excluding IDs already present
    in the working or removed collections.
    """
    # Get distinct IDs from working and removed collections
    # Check if collections have documents to avoid errors with empty/non-existent collections
    working_ids = list(working.distinct("_id")) if working.estimated_document_count() > 0 else []
    removed_ids = list(removed.distinct("_id")) if removed.estimated_document_count() > 0 else []
    skip_ids = working_ids + removed_ids

    # Aggregate pipeline to find documents not in skip_ids and sample up to limit
    pipeline = [
        {"$match": {"_id": {"$nin": skip_ids}}}, # Match documents whose _id is not in skip_ids
        {"$sample": {"size": limit}},            # Randomly sample up to the specified limit
    ]
    return list(papers.aggregate(pipeline))


def build_prompt(doc: dict) -> str:
    """Builds the user prompt string for the LLM from a document's title and abstract."""
    title = doc.get('title', '')
    abstract = doc.get('abstract', '')
    return f"Title: {title}\nAbstract: {abstract}"


def _call_openai_api(batch: List[dict]) -> List[str]:
    """Helper function to make API calls to OpenAI's chat completion endpoint."""
    results = []
    # Ensure openai_client is initialized
    if openai_client is None:
        raise RuntimeError("OpenAI client not initialized.")

    # Iterate through each document in the batch with a progress bar
    for doc in tqdm(batch, desc="Calling OpenAI API"):
        for attempt in range(3): # Retry mechanism for transient network or API errors (up to 3 attempts)
            try:
                # Call OpenAI chat completions API with system and user messages
                resp = openai_client.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT}, # System instructions
                        {"role": "user", "content": build_prompt(doc)}, # User prompt with doc content
                    ],
                    temperature=0.01, # Low temperature for more deterministic and less creative responses
                    max_tokens=200,   # Limit the length of the LLM's response
                )
                # Extract and store the text content from the response
                results.append(resp.choices[0].message.content.strip())
                break  # Break out of retry loop on successful API call
            except openai.APIError as e:
                # Handle specific OpenAI API errors, e.g., rate limits, invalid requests
                print(f"OpenAI API error for doc {doc.get('_id')}, attempt {attempt+1}: {e}", file=sys.stderr)
                if attempt == 2: # If this was the last attempt, re-raise the exception
                    raise e
                time.sleep(2 ** attempt + 1) # Exponential back-off before retrying
            except Exception as e:
                # Catch any other unexpected errors during the API call
                print(f"An unexpected error occurred for doc {doc.get('_id')}, attempt {attempt+1}: {e}", file=sys.stderr)
                if attempt == 2:
                    raise e
                time.sleep(2 ** attempt + 1)
        time.sleep(0.2)  # Small throttle between individual document API calls to avoid hitting hitting limits

    return results

def _call_gemini_api(batch: List[dict]) -> List[str]:
    """
    Helper function to make API calls to Google Gemini's generate content endpoint
    using the genai.Client and GenerateContentConfig for system instructions.
    """
    results = []
    # Ensure gemini_client is initialized
    if gemini_client is None:
        raise RuntimeError("Gemini client not initialized.")

    # Iterate through each document in the batch with a progress bar
    for doc in tqdm(batch, desc="Calling Gemini API"):
        for attempt in range(3): # Retry mechanism for transient network or API errors
            try:
                # Call Gemini's generate_content API with the user prompt and a config object.
                # The system instructions and generation parameters are passed in the config.
                resp = gemini_client.models.generate_content(
                    model=MODEL_NAME,
                    contents=[build_prompt(doc)], # User prompt as a list of contents
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT, # System instructions via config
                        temperature=0.01, # Low temperature for more deterministic responses
                        max_output_tokens=200, # Limit the length of the LLM's response
                    )
                )
                # Check if the response contains valid text candidates
                if resp.candidates and resp.candidates[0].content.parts:
                    results.append(resp.text.strip()) # Extract and store the text content
                    break # Break out of retry loop on success
                else:
                    # If Gemini returns no content, log a warning and retry
                    print(f"Gemini returned no content for doc {doc.get('_id')}.", file=sys.stderr)
                    if attempt == 2:
                        raise ValueError("Gemini returned no content after multiple attempts.")
                    time.sleep(2 ** attempt + 1)

            except Exception as e:
                # Catch any errors during the API call (e.g., network issues, invalid requests)
                print(f"Gemini API error for doc {doc.get('_id')}, attempt {attempt+1}: {e}", file=sys.stderr)
                if attempt == 2: # If this was the last attempt, re-raise the exception
                    raise e
                time.sleep(2 ** attempt + 1) # Exponential back-off
        time.sleep(0.2) # Small throttle between individual document API calls

    return results


def call_llm(batch: List[dict]) -> List[str]:
    """
    Dispatches to the appropriate LLM API call function (_call_openai_api or _call_gemini_api)
    based on the configured LLM_PROVIDER.
    """
    if LLM_PROVIDER == "openai":
        return _call_openai_api(batch)
    elif LLM_PROVIDER == "gemini":
        return _call_gemini_api(batch)
    else:
        # This case should ideally be caught by the initial validation at script start,
        # but included here for defensive programming.
        raise ValueError("Invalid LLM_PROVIDER configured. Cannot call LLM.")


def parse_and_store(doc: dict, response: str):
    """
    Parses the LLM's response to extract the decision and certainty percentage.
    Stores the document along with the LLM's response, decision, and certainty
    in either the 'working' (positive) or 'removed' (negative) collection.
    If a document is classified as 'no' with a certainty above DELETE_THRESHOLD,
    it is also removed from the original 'papers' collection.
    """
    try:
        m_dec  = DECISION_RE.search(response)
        # Extract decision (e.g., "yes", "no", "not sure"), default to "not sure" if not found
        decision = (m_dec.group(1).lower() if m_dec else "not sure")

        m_cert = CERT_RE.search(response)
        # Extract certainty percentage, default to None if not found
        certainty = float(m_cert.group(1)) if m_cert else None

        # Prepare payload for MongoDB insertion/update
        payload = {
            "_id": doc["_id"], # Use the original document's _id
            "title": doc.get("title"),
            "abstract": doc.get("abstract"),
            "response": response,
            "certainty": certainty,
            "llm_provider": LLM_PROVIDER, # Record which LLM was used for this labeling
            "model_name": MODEL_NAME,     # Record which specific model was used
        }

        # Determine target collection based on the decision
        coll = working if decision == "yes" else removed
        # Upsert the document: insert if _id doesn't exist, update if it does
        coll.replace_one({"_id": doc["_id"]}, payload, upsert=True)

        # If the document was classified as 'no' with high certainty, delete it from the source collection
        if coll is removed and certainty is not None and certainty >= DELETE_THRESHOLD:
            papers.delete_one({"_id": doc["_id"]})
            print(f"Deleted doc {doc['_id']} from '{PAPERS_COLL}' (Negative, certainty: {certainty}%)")
    except Exception as e:
        # Log any errors during parsing or storage and exit the script
        print(f"Error processing and storing doc {doc.get('_id')}: {e}", file=sys.stderr)
        sys.exit(1) # Exit script upon encountering a critical error


if __name__ == "__main__":
    # Print initial configuration details for the user
    print(f"Starting paper labeling process.")
    print(f"LLM Provider: {LLM_PROVIDER.upper()}")
    print(f"Model Name: {MODEL_NAME}")
    print(f"MongoDB URI: {MONGO_URI}")
    print(f"Database: {DB_NAME}")
    print(f"Source Collection: {PAPERS_COLL}")
    print(f"Positive Collection: {WORKING_COLL}")
    print(f"Negative Collection: {REMOVED_COLL}")
    print(f"Batch Size: {BATCH_SIZE}")
    print(f"Limit: {LIMIT}")
    print(f"Delete Threshold: {DELETE_THRESHOLD}%")

    try:
        # Fetch documents that are yet to be labeled, up to the specified LIMIT
        docs_to_process = fetch_unlabeled(LIMIT)
        print(f"Found {len(docs_to_process)} unlabeled documents to process.")

        if not docs_to_process:
            print("No new documents to label. Exiting.")
            sys.exit(0) # Exit gracefully if no documents are found

        # Process documents in batches as defined by BATCH_SIZE
        for idx, batch in enumerate(chunked(docs_to_process, BATCH_SIZE), 1):
            # Call the selected LLM (OpenAI or Gemini) for the current batch of documents
            responses = call_llm(batch)

            # Process each document and its corresponding LLM response
            for doc, resp in zip(batch, responses):
                parse_and_store(doc, resp)
                # Print a truncated response for cleaner output
                print(f"Processed doc {doc.get('_id')}: {resp.splitlines()[0]}...")

            # Provide progress update after each batch
            done = min(idx * BATCH_SIZE, len(docs_to_process))
            if done % 20 == 0 or done == len(docs_to_process): # Print every 20 documents or when done
                print(f"Labeled {done}/{len(docs_to_process)} documents.")

        print("Labeling process completed successfully.")

    except RuntimeError as e:
        # Catch configuration-related errors
        print(f"Configuration Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        # Catch any unhandled general exceptions
        print(f"An unhandled error occurred: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Ensure the MongoDB client connection is always closed
        if 'client' in locals() and client:
            client.close()
            print("MongoDB connection closed.")