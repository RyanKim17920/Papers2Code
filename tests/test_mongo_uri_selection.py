import importlib
import sys
from pathlib import Path

import pytest

# Guarantee the repository root is importable when tests run in isolation
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(autouse=True)
def reload_shared_module(monkeypatch):
    import papers2code_app2.shared as shared_module

    yield shared_module

    importlib.reload(shared_module)


def _reset_env(monkeypatch, keys):
    for key in keys:
        monkeypatch.delenv(key, raising=False)


def test_dev_prefers_mongo_dev(monkeypatch, reload_shared_module):
    from papers2code_app2.shared import get_mongo_uri

    keys = ("ENV_TYPE", "MONGO_URI_DEV", "MONGO_URI_PROD", "MONGO_URI_PROD_TEST")
    _reset_env(monkeypatch, keys)

    monkeypatch.setenv("ENV_TYPE", "DEV")
    monkeypatch.setenv("MONGO_URI_DEV", "mongodb://dev.example/papers2codedev")
    monkeypatch.setenv("MONGO_URI_PROD", "mongodb://prod.example/papers2code")
    monkeypatch.setenv("MONGO_URI_PROD_TEST", "mongodb://test.example/papers2code_test")

    uri = get_mongo_uri()
    assert uri == "mongodb://dev.example/papers2codedev"


def test_prod_test_uses_prod_test(monkeypatch, reload_shared_module):
    from papers2code_app2.shared import get_mongo_uri

    keys = ("ENV_TYPE", "MONGO_URI_PROD_TEST", "MONGO_URI_PROD")
    _reset_env(monkeypatch, keys)

    monkeypatch.setenv("ENV_TYPE", "PROD_TEST")
    monkeypatch.setenv("MONGO_URI_PROD_TEST", "mongodb://test.example/papers2code_test")
    monkeypatch.setenv("MONGO_URI_PROD", "mongodb://prod.example/papers2code")

    uri = get_mongo_uri()
    assert uri == "mongodb://test.example/papers2code_test"
