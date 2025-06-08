import os
import re
import time
import dotenv
from typing import List
from pymongo import MongoClient
import openai
from tqdm import tqdm
import sys
"""Automatically label CS papers with an OpenAI chat model and optionally
remove high‑certainty negatives from the source collection.

Env requirements (set via .env or shell):
  OPENAI_API_KEY   – your key
  MONGO_URI        – connection string for MongoDB
  DB_NAME          – database name (default: papers2code)
  PAPERS_COLL      – input collection (default: papers)
  WORKING_COLL     – positive label collection (default: working_papers)
  REMOVED_COLL     – negative label collection (default: removed_papers)
  MODEL_NAME       – chat model (default: gpt-4o-mini)
  BATCH_SIZE       – docs per API call (default: 1)
  LIMIT            – max docs to label this run (default: 1000)
  DELETE_THRESHOLD – certainty percentage above which a negative sample is
                     deleted from PAPERS_COLL (default: 80)
"""

dotenv.load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")        
if not openai_api_key:
    raise RuntimeError("OPENAI_API_KEY not set")
openai.api_key = openai_api_key

MONGO_URI = os.getenv("MONGO_URI_PROD", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "papers2code")
PAPERS_COLL = os.getenv("PAPERS_COLL", "papers")
WORKING_COLL = os.getenv("WORKING_COLL", "working_papers")
REMOVED_COLL = os.getenv("REMOVED_COLL", "removed_papers")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4.1")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", 1))
LIMIT = int(os.getenv("LIMIT", 10000))
DELETE_THRESHOLD = float(os.getenv("DELETE_THRESHOLD", 90))  # percentage

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
papers = db[PAPERS_COLL]
working = db[WORKING_COLL]
removed = db[REMOVED_COLL]

SYSTEM_PROMPT = SYSTEM_PROMPT = """
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

DECISION_RE = re.compile(r"^(yes|no|not sure)\b.*", re.I | re.M)  # capture whole line
CERT_RE     = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def fetch_unlabeled(limit: int) -> List[dict]:
    """Return up to `limit` unlabeled docs."""
    skip_ids = list(working.distinct("_id")) + list(removed.distinct("_id"))
    pipeline = [
        {"$match": {"_id": {"$nin": skip_ids}}},
        {"$sample": {"size": limit}},
    ]
    return list(papers.aggregate(pipeline))


def build_prompt(doc: dict) -> str:
    return f"Title: {doc.get('title', '')}\nAbstract: {doc.get('abstract', '')}"


def call_openai(batch: List[dict]) -> List[str]:
    """Send each doc in *batch*; simple sequential loop with retry/back-off."""
    results = []
    for doc in tqdm(batch):
        for attempt in range(3):
            try:
                resp = openai.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": build_prompt(doc)},
                    ],
                    temperature=0.01,
                    max_tokens=200,
                )
                results.append(resp.choices[0].message.content.strip())
                break  # success
            except Exception as e:
                if attempt == 2:
                    raise e
                time.sleep(2 ** attempt)  # exponential back-off
        time.sleep(0.2)  # light global throttle
    return results


def parse_and_store(doc: dict, response: str):
    """Upsert decision; optionally delete high-certainty negatives."""
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
        }

        coll = working if decision == "yes" else removed
        coll.replace_one({"_id": doc["_id"]}, payload, upsert=True)

        if coll is removed and certainty and certainty >= DELETE_THRESHOLD:
            papers.delete_one({"_id": doc["_id"]})
    except Exception as e:
        print(f"Error processing doc {doc['_id']}: {e}")
        sys.exit(1)
        return 


if __name__ == "__main__":
    docs = fetch_unlabeled(LIMIT)
    print(f"Processing {len(docs)} documents …")

    for idx, batch in enumerate(chunked(docs, BATCH_SIZE), 1):
        for doc, resp in zip(batch, call_openai(batch)):
            parse_and_store(doc, resp)
            print(f"Processed doc {doc['_id']}: {resp}")

        done = min(idx * BATCH_SIZE, len(docs))
        if done % 20 == 0 or done == len(docs):
            print(f"Labeled {done}/{len(docs)}")
