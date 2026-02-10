import logging
import time
import math
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pymongo import ASCENDING

from ..database import get_papers_collection_async

router = APIRouter(prefix="/seo", tags=["seo"])
logger = logging.getLogger(__name__)

BASE_URL = "https://papers2code.com"
CHUNK_SIZE = 50_000
COUNT_CACHE_TTL = 3600  # 1 hour
CHUNK_CACHE_TTL = 300   # 5 minutes

# Simple in-memory caches
_count_cache: dict = {"value": None, "ts": 0.0}
_chunk_cache: dict = {}  # key: chunk_index, value: {"xml": str, "ts": float}


async def _get_paper_count() -> int:
    """Return total paper count, cached for 1 hour."""
    now = time.monotonic()
    if _count_cache["value"] is not None and (now - _count_cache["ts"]) < COUNT_CACHE_TTL:
        return _count_cache["value"]

    papers_col = await get_papers_collection_async()
    count = await papers_col.estimated_document_count()
    _count_cache["value"] = count
    _count_cache["ts"] = now
    return count


def _format_date(dt) -> str:
    """Format a datetime to W3C date string for sitemaps."""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@router.get("/sitemap.xml")
async def sitemap_index():
    """Return a sitemap index listing all chunk URLs."""
    total = await _get_paper_count()
    num_chunks = max(1, math.ceil(total / CHUNK_SIZE))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for i in range(num_chunks):
        lines.append(
            f"  <sitemap>"
            f"<loc>{BASE_URL}/api/seo/sitemap-{i}.xml</loc>"
            f"</sitemap>"
        )
    lines.append("</sitemapindex>")

    xml = "\n".join(lines)
    return Response(content=xml, media_type="application/xml")


@router.get("/sitemap-{chunk}.xml")
async def sitemap_chunk(chunk: int):
    """Return a sitemap chunk with up to 50K paper URLs."""
    total = await _get_paper_count()
    num_chunks = max(1, math.ceil(total / CHUNK_SIZE))

    if chunk < 0 or chunk >= num_chunks:
        raise HTTPException(status_code=404, detail="Sitemap chunk not found")

    # Check chunk cache
    now = time.monotonic()
    cached = _chunk_cache.get(chunk)
    if cached and (now - cached["ts"]) < CHUNK_CACHE_TTL:
        return Response(content=cached["xml"], media_type="application/xml")

    # Build XML
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    # Chunk 0 includes static pages
    if chunk == 0:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        lines.append(
            f"  <url><loc>{BASE_URL}/</loc>"
            f"<lastmod>{today}</lastmod>"
            f"<changefreq>daily</changefreq>"
            f"<priority>1.0</priority></url>"
        )
        lines.append(
            f"  <url><loc>{BASE_URL}/papers</loc>"
            f"<lastmod>{today}</lastmod>"
            f"<changefreq>daily</changefreq>"
            f"<priority>0.9</priority></url>"
        )

    # Query papers for this chunk
    papers_col = await get_papers_collection_async()
    cursor = papers_col.find(
        {},
        {"_id": 1, "publicationDate": 1},
    ).sort("_id", ASCENDING).skip(chunk * CHUNK_SIZE).limit(CHUNK_SIZE)

    async for doc in cursor:
        paper_id = str(doc["_id"])
        lastmod = _format_date(doc.get("publicationDate"))
        lines.append(
            f"  <url><loc>{BASE_URL}/paper/{paper_id}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<changefreq>weekly</changefreq>"
            f"<priority>0.6</priority></url>"
        )

    lines.append("</urlset>")
    xml = "\n".join(lines)

    # Cache the result
    _chunk_cache[chunk] = {"xml": xml, "ts": now}

    return Response(content=xml, media_type="application/xml")
