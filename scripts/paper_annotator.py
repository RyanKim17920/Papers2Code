import os
import dotenv
from pymongo import MongoClient
from scripts.utils_dbkeys import get_pwc_url
import gradio as gr

# ---------------------------------------------------------------------------
# Load environment variables (expects MONGO_URI in .env or shell)
# ---------------------------------------------------------------------------
dotenv.load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI_PROD_TEST", "mongodb://localhost:27017/")

# ---------------------------------------------------------------------------
# MongoDB collections
# ---------------------------------------------------------------------------
DB_NAME = "papers2code"
PAPERS_COLL = "papers"
REMOVED_COLL = "removed_papers"
WORKING_COLL = "working_papers"

client = MongoClient(MONGO_URI)

client.admin.command("ping")  # Test connection
print("Connected to MongoDB")

db = client[DB_NAME]
papers = db[PAPERS_COLL]
removed = db[REMOVED_COLL]
working = db[WORKING_COLL]

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _progress() -> str:
    """Return current labelling progress."""
    done = removed.estimated_document_count() + working.estimated_document_count()
    total = papers.estimated_document_count()
    return f"Labeled: {done} / {total}"


def _next_paper():
    """Sample one unseen paper (skip those already labelled)."""
    skip_ids = sorted(  # sort so order is independent of insertion order
        set(removed.distinct("_id")).union(working.distinct("_id"))
    )
    pipeline = [
        {"$match": {"_id": {"$nin": skip_ids}}},
        {"$sample": {"size": 1}},
    ]
    docs = list(papers.aggregate(pipeline))
    return docs[0] if docs else None

# ---------------------------------------------------------------------------
# Gradio callbacks
# ---------------------------------------------------------------------------

STATE_TEMPLATE = {"current": None}


def load_next(state):
    doc = _next_paper()
    if doc is None:
        return "No more papers", "All papers annotated 🎉", _progress(), state

    state["current"] = doc
    return doc.get("title", ""), doc.get("abstract", ""), _progress(), state


def mark_relevant(state):
    doc = state.get("current")
    if doc:
        working.insert_one({"_id": doc["_id"], "title": doc["title"], "abstract": doc["abstract"]})
    return load_next(state)


def mark_irrelevant(state):
    doc = state.get("current")
    if doc:
        removed.insert_one({
            "_id": doc["_id"],
            "title": doc["title"],
            "abstract": doc["abstract"],
            "pwcUrl": get_pwc_url(doc),
        })
        papers.delete_one({"_id": doc["_id"]})
    return load_next(state)

# ---------------------------------------------------------------------------
# Gradio UI
# ---------------------------------------------------------------------------

with gr.Blocks() as demo:
    gr.Markdown("# Paper Annotation Tool")

    title_box = gr.Textbox(label="Title", lines=2)
    abstract_box = gr.Textbox(label="Abstract", lines=8)
    counter_box = gr.Markdown()

    with gr.Row():
        yes_btn = gr.Button("Relevant ✅", variant="primary")
        no_btn = gr.Button("Irrelevant ❌")
        next_btn = gr.Button("Skip / Next ➡")

    state_var = gr.State(STATE_TEMPLATE.copy())

    yes_btn.click(
        mark_relevant,
        inputs=state_var,
        outputs=[title_box, abstract_box, counter_box, state_var],
    )
    no_btn.click(
        mark_irrelevant,
        inputs=state_var,
        outputs=[title_box, abstract_box, counter_box, state_var],
    )
    next_btn.click(
        load_next,
        inputs=state_var,
        outputs=[title_box, abstract_box, counter_box, state_var],
    )

    # Load first paper automatically when the UI mounts
    demo.load(
        load_next, inputs=state_var, outputs=[title_box, abstract_box, counter_box, state_var]
    )

if __name__ == "__main__":
    demo.launch()
