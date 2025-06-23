import os
import re
import time
import dotenv
from typing import List
from pymongo import MongoClient
import openai
from google import genai
from google.genai import types
from tqdm import tqdm
import sys
import collections # Import for deque

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
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

openai_client = None
gemini_client = None

if LLM_PROVIDER == "openai":
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not set in environment or .env file for OpenAI provider.")
    openai.api_key = openai_api_key
    MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
    # Ensure we're not using a Gemini model with OpenAI
    if "gemini" in MODEL_NAME.lower():
        MODEL_NAME = "gpt-4o-mini"
        print(f"Warning: Gemini model detected with OpenAI provider. Using {MODEL_NAME} instead.")
    openai_client = openai.chat.completions
elif LLM_PROVIDER == "gemini":
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        raise RuntimeError("GOOGLE_API_KEY not set in environment or .env file for Gemini provider.")
    
    gemini_client = genai.Client(api_key=google_api_key) 
    MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.5-flash-lite-preview-06-17")
    # Ensure we're not using an OpenAI model with Gemini
    if "gpt" in MODEL_NAME.lower():
        MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"
        print(f"Warning: OpenAI model detected with Gemini provider. Using {MODEL_NAME} instead.")
else:
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

# --- Rate Limiting Configuration for Gemini ---
# We'll set a slightly conservative rate to be safe.
GEMINI_RPM_LIMIT = 10
GEMINI_TIME_WINDOW = 60 # seconds

# --- Database Connection ---
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
papers = db[PAPERS_COLL]
working = db[WORKING_COLL]
removed = db[REMOVED_COLL]

# --- LLM System Prompt ---
SYSTEM_PROMPT = """
Identify computer-science papers that introduce a clearly novel, reusable software-side contribution (method, algorithm, system, or technique).
Use the title and abstract only.

A paper is “yes” if all four bullets below are satisfied.
1. It is AI, ML, or data-science focused.
2. It proposes a NEW or IMPROVED software method/algorithm/system, not just an application or benchmark.
3. The innovation can be re-implemented without proprietary or exotic hardware.
4. The contribution is reusable/extensible by the community.

“No” papers include (but aren’t limited to):
Surveys, dataset or benchmark descriptions, or purely empirical studies with no new software idea.
Works that only apply existing models to new datasets or tweak hyper-parameters.
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

# --- Rate Limiter Class ---
class GeminiRateLimiter:
    def __init__(self, rpm_limit: int, time_window: int):
        self.rpm_limit = rpm_limit
        self.time_window = time_window
        self.timestamps = collections.deque()

    def wait_for_token(self):
        current_time = time.time()

        # Remove timestamps older than the time window
        while self.timestamps and self.timestamps[0] <= current_time - self.time_window:
            self.timestamps.popleft()

        # If we have exceeded the limit, wait
        if len(self.timestamps) >= self.rpm_limit:
            wait_time = self.time_window - (current_time - self.timestamps[0])
            if wait_time > 0:
                # print(f"Rate limit hit. Waiting for {wait_time:.2f} seconds.") # Debugging line
                time.sleep(wait_time)
            # After waiting, clean up again to be sure
            while self.timestamps and self.timestamps[0] <= time.time() - self.time_window:
                self.timestamps.popleft()
        
        # Record the current request time
        self.timestamps.append(time.time())

# Initialize the rate limiter for Gemini
gemini_rate_limiter = GeminiRateLimiter(GEMINI_RPM_LIMIT, GEMINI_TIME_WINDOW)

def chunked(iterable: List[dict], n: int):
    """Yield successive n-sized chunks (tiny helper, avoids external libs)."""
    for i in range(0, len(iterable), n):
        yield iterable[i : i + n]

# Regex to parse the decision and certainty from the LLM's response
DECISION_RE = re.compile(r"^(yes|no|not sure)\b.*", re.I | re.M)
CERT_RE     = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def fetch_unlabeled(limit: int) -> List[dict]: 
    """
    Return up to `limit` unlabeled documents by excluding IDs already present
    in the working or removed collections.
    """ 
    working_ids = list(working.distinct("_id")) if working.estimated_document_count() > 0 else []
    removed_ids = list(removed.distinct("_id")) if removed.estimated_document_count() > 0 else []
    skip_ids = working_ids + removed_ids

    pipeline = [
        {"$match": {"_id": {"$nin": skip_ids}}},
        {"$sample": {"size": limit}},
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
    if openai_client is None:
        raise RuntimeError("OpenAI client not initialized.")

    for doc in tqdm(batch, desc="Calling OpenAI API"):
        for attempt in range(3):
            try:
                resp = openai_client.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": build_prompt(doc)},
                    ],
                    temperature=0.01,
                    max_tokens=200,
                )
                results.append(resp.choices[0].message.content.strip())
                break
            except openai.APIError as e:
                print(f"OpenAI API error for doc {doc.get('_id')}, attempt {attempt+1}: {e}", file=sys.stderr)
                if attempt == 2:
                    raise e
                time.sleep(2 ** attempt + 1) # Exponential back-off for API errors
            except Exception as e:
                print(f"An unexpected error occurred for doc {doc.get('_id')}, attempt {attempt+1}: {e}", file=sys.stderr)
                if attempt == 2:
                    raise e
                time.sleep(2 ** attempt + 1) # Exponential back-off for other errors

    return results

def _call_gemini_api(batch: List[dict]) -> List[str]:
    """
    Helper function to make API calls to Google Gemini's generate content endpoint
    using the genai.Client and GenerateContentConfig for system instructions,
    with built-in rate limiting.
    """
    results = []
    if gemini_client is None:
        raise RuntimeError("Gemini client not initialized.")

    for doc in tqdm(batch, desc="Calling Gemini API"):
        # Wait for a token from the rate limiter before making the call
        gemini_rate_limiter.wait_for_token()

        for attempt in range(3):
            try:
                resp = gemini_client.models.generate_content(
                    model=MODEL_NAME,
                    contents=[build_prompt(doc)],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.01,
                        max_output_tokens=200,
                    )
                )
                if resp.candidates and resp.candidates[0].content.parts:
                    results.append(resp.candidates[0].content.parts[0].text.strip())
                    break
                else:
                    print(f"Gemini returned no content for doc {doc.get('_id')} after {attempt+1} attempts.", file=sys.stderr)
                    if attempt == 2:
                        raise ValueError("Gemini returned no content after multiple attempts.")
                    time.sleep(2 ** attempt + 1) # Exponential back-off before retrying
            except Exception as e:
                print(f"Gemini API error for doc {doc.get('_id')}, attempt {attempt+1}: {e}", file=sys.stderr)
                if attempt == 2:
                    raise e
                time.sleep(2 ** attempt + 1) # Exponential back-off for any error

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
        decision = (m_dec.group(1).lower() if m_dec else "not sure")

        m_cert = CERT_RE.search(response)
        certainty = float(m_cert.group(1)) if m_cert else None

        payload = {
            "_id": doc["_id"],
            "title": doc.get("title"),
            "abstract": doc.get("abstract"),
            "response": response,
            "certainty": certainty,
            "llm_provider": LLM_PROVIDER,
            "model_name": MODEL_NAME,
        }

        coll = working if decision == "yes" else removed
        print(f"Classified doc {doc['_id']} as '{decision}' with certainty {certainty}%.")
        coll.replace_one({"_id": doc["_id"]}, payload, upsert=True)

        if coll is removed and certainty is not None and certainty >= DELETE_THRESHOLD:
            papers.delete_one({"_id": doc["_id"]})
            print(f"Deleted doc {doc['_id']} from '{PAPERS_COLL}' (Negative, certainty: {certainty}%)")
    except Exception as e:
        print(f"Error processing and storing doc {doc.get('_id')}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
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
    if LLM_PROVIDER == "gemini":
        print(f"Gemini Rate Limit: {GEMINI_RPM_LIMIT} requests per {GEMINI_TIME_WINDOW} seconds.")


    try:
        docs_to_process = fetch_unlabeled(LIMIT)
        print(f"Found {len(docs_to_process)} unlabeled documents to process.")

        if not docs_to_process:
            print("No new documents to label. Exiting.")
            sys.exit(0)

        for idx, batch in enumerate(chunked(docs_to_process, BATCH_SIZE), 1):
            responses = call_llm(batch)

            for doc, resp in zip(batch, responses):
                parse_and_store(doc, resp)
                print(f"Processed doc {doc.get('_id')}: {resp.splitlines()[0]}...")

            done = min(idx * BATCH_SIZE, len(docs_to_process))
            if done % 20 == 0 or done == len(docs_to_process):
                print(f"Labeled {done}/{len(docs_to_process)} documents.")

        print("Labeling process completed successfully.")

    except RuntimeError as e:
        print(f"Configuration Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unhandled error occurred: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if 'client' in locals() and client:
            client.close()
            print("MongoDB connection closed.")