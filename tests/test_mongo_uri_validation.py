import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from papers2code_app2.shared import ensure_valid_mongo_uri


def test_accepts_valid_atlas_uri():
    uri = "mongodb+srv://real_user:real_pass@cluster.mongodb.net/papers2code?retryWrites=true&w=majority"
    assert ensure_valid_mongo_uri(uri, "MONGO_URI_DEV") == uri


def test_accepts_localhost_uri():
    uri = "mongodb://localhost:27017/papers2code_dev"
    assert ensure_valid_mongo_uri(uri, "MONGO_URI_DEV") == uri


def test_rejects_placeholder_uri():
    placeholder_uri = "mongodb+srv://your_username:your_password@your-cluster.mongodb.net/papers2code"
    with pytest.raises(RuntimeError) as exc:
        ensure_valid_mongo_uri(placeholder_uri, "MONGO_URI_DEV")
    assert "placeholder" in str(exc.value)
    assert "MONGO_URI_DEV" in str(exc.value)
