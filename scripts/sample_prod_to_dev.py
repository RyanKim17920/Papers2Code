#!/usr/bin/env python

"""Copy a random sample of papers from production MongoDB into the dev database.

Usage:
    uv run python scripts/sample_prod_to_dev.py --size 100

This script connects to the production cluster defined by MONGO_URI_PROD and the
development cluster defined by MONGO_URI_DEV, randomly samples ``size`` papers
from the ``papers`` collection in production, and upserts them into the dev
collection. Existing papers are updated in-place so you can safely run it
multiple times.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Iterable, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import BulkWriteError
from pymongo.operations import ReplaceOne

try:
    import certifi
except ImportError:  # pragma: no cover
    certifi = None


DEFAULT_SAMPLE_SIZE = 100


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--size",
        type=int,
        default=DEFAULT_SAMPLE_SIZE,
        help="Number of papers to sample from production (default: %(default)s)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompt (useful for automated runs)",
    )
    parser.add_argument(
        "--allow-invalid-cert",
        action="store_true",
        help="Skip TLS certificate validation (only use if you trust the cluster)",
    )
    return parser.parse_args()


def require_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise SystemExit(f"Missing required environment variable: {key}")
    return value


def resolve_db_name(*env_keys: str, fallback: Optional[str] = None, uri: Optional[str] = None) -> str:
    for key in env_keys:
        value = os.getenv(key)
        if value:
            return value

    if uri:
        parsed = urlparse(uri)
        candidate = parsed.path.lstrip("/")
        if candidate:
            # Strip collection info if provided via /db/collection pattern
            return candidate.split("/", 1)[0]

    if fallback:
        return fallback

    raise SystemExit(
        "Unable to determine database name. Set one of: " + ", ".join(env_keys)
    )


@dataclass
class MongoConfig:
    uri: str
    db_name: str
    allow_invalid_cert: bool = False

    def connect(self) -> MongoClient:
        client_kwargs = {"serverSelectionTimeoutMS": 5000}
        if self.allow_invalid_cert:
            client_kwargs["tlsAllowInvalidCertificates"] = True
        elif certifi is not None:
            client_kwargs["tlsCAFile"] = certifi.where()
        return MongoClient(self.uri, **client_kwargs)


def confirm(prompt: str) -> bool:
    reply = input(f"{prompt} [y/N]: ").strip().lower()
    return reply in {"y", "yes"}


def sample_papers(collection: Collection, size: int) -> list[dict]:
    total = collection.estimated_document_count()
    if not total:
        raise SystemExit("Production papers collection is empty!")

    actual_size = min(size, total)
    pipeline = [{"$sample": {"size": actual_size}}]
    return list(collection.aggregate(pipeline))


def upsert_documents(collection: Collection, docs: Iterable[dict]) -> None:
    operations = [ReplaceOne({"_id": doc["_id"]}, doc, upsert=True) for doc in docs]
    if not operations:
        print("Nothing to upsert – exiting.")
        return

    try:
        result = collection.bulk_write(operations, ordered=False)
    except BulkWriteError as exc:
        print("Bulk write completed with errors but continuing.")
        print(exc.details)
        return

    print(
        "Upsert complete:"
        f" matched={result.matched_count},"
        f" modified={result.modified_count},"
        f" upserts={len(result.upserted_ids)}"
    )


def main() -> None:
    load_dotenv()
    args = parse_args()

    if args.size <= 0:
        raise SystemExit("Sample size must be a positive integer.")

    prod_uri = require_env("MONGO_URI_PROD")
    dev_uri = require_env("MONGO_URI_DEV")

    prod_db_name = resolve_db_name("MONGO_DB_NAME_PROD", "SOURCE_DB_NAME", uri=prod_uri)
    dev_db_name = resolve_db_name("MONGO_DB_NAME_DEV", "TARGET_DB_NAME", fallback="papers2codedev", uri=dev_uri)

    prod_cfg = MongoConfig(prod_uri, prod_db_name, allow_invalid_cert=args.allow_invalid_cert)
    dev_cfg = MongoConfig(dev_uri, dev_db_name, allow_invalid_cert=args.allow_invalid_cert)

    if not args.force:
        print("This will copy papers from production -> development")
        print(f"  Production DB: {prod_cfg.db_name} ({prod_cfg.uri})")
        print(f"  Development DB: {dev_cfg.db_name} ({dev_cfg.uri})")
        if prod_cfg.allow_invalid_cert:
            print("  TLS validation: DISABLED (allow-invalid-cert)")
        if not confirm("Continue?"):
            print("Aborted by user.")
            return

    prod_client = prod_cfg.connect()
    dev_client = dev_cfg.connect()

    prod_db = prod_client[prod_cfg.db_name]
    dev_db = dev_client[dev_cfg.db_name]

    print(f"Sampling up to {args.size} papers from production ({prod_cfg.db_name})...")
    sampled = sample_papers(prod_db.papers, args.size)
    print(f"Sampled {len(sampled)} papers. Upserting into dev ({dev_cfg.db_name})...")

    upsert_documents(dev_db.papers, sampled)
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("Interrupted.")