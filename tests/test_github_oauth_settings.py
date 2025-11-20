import importlib
import sys
from pathlib import Path
from typing import Iterable

import pytest

# Guarantee the repository root is importable when tests run in isolation
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(autouse=True)
def reload_shared_module(monkeypatch):
    """Ensure environment mutations are applied fresh for each test."""
    # Import locally to avoid circular imports at module load time
    import papers2code_app2.shared as shared_module

    yield shared_module

    # Clear cached settings so future tests can re-import cleanly if needed
    importlib.reload(shared_module)


def _reset_env(monkeypatch, keys: Iterable[str]) -> None:
    for key in keys:
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def github_env_keys():
    return (
        "ENV_TYPE",
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "GITHUB_CLIENT_ID_DEV",
        "GITHUB_CLIENT_SECRET_DEV",
    )


def test_dev_env_prefers_dev_credentials(monkeypatch, github_env_keys, reload_shared_module):
    from papers2code_app2.shared import GitHubOAuthSettings

    _reset_env(monkeypatch, github_env_keys)

    monkeypatch.setenv("ENV_TYPE", "DEV")
    monkeypatch.setenv("GITHUB_CLIENT_ID_DEV", "dev-id-123")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET_DEV", "dev-secret-456")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "prod-id-999")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "prod-secret-999")

    settings = GitHubOAuthSettings()

    assert settings.CLIENT_ID == "dev-id-123"
    assert settings.CLIENT_SECRET == "dev-secret-456"


def test_dev_env_falls_back_to_prod_when_dev_missing(monkeypatch, github_env_keys, reload_shared_module):
    from papers2code_app2.shared import GitHubOAuthSettings

    _reset_env(monkeypatch, github_env_keys)

    monkeypatch.setenv("ENV_TYPE", "development")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "prod-id-abc")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "prod-secret-abc")

    settings = GitHubOAuthSettings()

    assert settings.CLIENT_ID == "prod-id-abc"
    assert settings.CLIENT_SECRET == "prod-secret-abc"


def test_prod_env_ignores_dev_credentials(monkeypatch, github_env_keys, reload_shared_module):
    from papers2code_app2.shared import GitHubOAuthSettings

    _reset_env(monkeypatch, github_env_keys)

    monkeypatch.setenv("ENV_TYPE", "production")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "prod-only-id")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "prod-only-secret")
    monkeypatch.setenv("GITHUB_CLIENT_ID_DEV", "dev-id-should-not-use")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET_DEV", "dev-secret-should-not-use")

    settings = GitHubOAuthSettings()

    assert settings.CLIENT_ID == "prod-only-id"
    assert settings.CLIENT_SECRET == "prod-only-secret"


def test_explicit_values_are_respected(monkeypatch, github_env_keys, reload_shared_module):
    from papers2code_app2.shared import GitHubOAuthSettings

    _reset_env(monkeypatch, github_env_keys)

    monkeypatch.setenv("ENV_TYPE", "DEV")
    monkeypatch.setenv("GITHUB_CLIENT_ID_DEV", "dev-id-override")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET_DEV", "dev-secret-override")

    settings = GitHubOAuthSettings(CLIENT_ID="manual-id", CLIENT_SECRET="manual-secret")

    assert settings.CLIENT_ID == "manual-id"
    assert settings.CLIENT_SECRET == "manual-secret"
