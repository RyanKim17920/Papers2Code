#!/usr/bin/env python3
"""Convenient orchestrator for local Papers2Code development services.

This utility makes it simple to spin up the Keycloak mock OAuth server (via Docker
Compose) and run the backend & frontend dev servers with a single command.

Example usage:

    uv run docker_run.py                # Start Keycloak, backend, and frontend
    uv run docker_run.py --skip-frontend
    uv run docker_run.py stop           # Stop only the Keycloak container

"""
from __future__ import annotations

import argparse
import os
import shlex
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import List, Optional

# Load .env file early so ENV_TYPE and other settings are available
try:
    from dotenv import load_dotenv
    ROOT_DIR = Path(__file__).resolve().parent
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        print(f"[docker_run] Loaded environment from {env_file}")
except ImportError:
    ROOT_DIR = Path(__file__).resolve().parent
    print("[docker_run] Warning: python-dotenv not installed, .env file not loaded")

UI_DIR = ROOT_DIR / "papers2code-ui"
DEFAULT_COMPOSE_FILE = ROOT_DIR / "docker-compose.dev.yml"
DEFAULT_BACKEND_CMD = "uv run run.py"
DEFAULT_FRONTEND_CMD = "npm run dev -- --host 0.0.0.0 --port 5173"


def print_header(message: str) -> None:
    """Utility logger with a consistent prefix."""
    print(f"[docker_run] {message}")


def detect_compose_command(compose_file: Path) -> List[str]:
    """Return the base docker compose command list, preferring v2 syntax."""
    compose_file = compose_file.resolve()
    docker_path = shutil.which("docker")
    docker_compose_path = shutil.which("docker-compose")

    if docker_path:
        # Check whether `docker compose` is supported
        result = subprocess.run(
            [docker_path, "compose", "version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode == 0:
            return [docker_path, "compose", "-f", str(compose_file)]

    if docker_compose_path:
        return [docker_compose_path, "-f", str(compose_file)]

    raise RuntimeError(
        "Neither `docker compose` nor `docker-compose` is available. "
        "Please install Docker Desktop or Docker Compose v2."
    )


class ComposeClient:
    """Tiny helper around docker compose commands."""

    def __init__(self, compose_file: Path):
        if not compose_file.exists():
            raise FileNotFoundError(f"Compose file not found: {compose_file}")
        self.compose_file = compose_file
        self.base_cmd = detect_compose_command(compose_file)

    def run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess:
        command = [*self.base_cmd, *args]
        result = subprocess.run(command)
        if check and result.returncode != 0:
            raise RuntimeError(
                f"Command failed ({result.returncode}): {' '.join(command)}"
            )
        return result

    def up_detached(self, services: List[str], rebuild: bool = False) -> None:
        if rebuild:
            self.run("build", *services)
        self.run("up", "-d", *services)

    def stop(self, services: Optional[List[str]] = None) -> None:
        args: List[str] = ["stop"]
        if services:
            args.extend(services)
        self.run(*args, check=False)


class ManagedProcess:
    """Represents a long-running subprocess whose logs should be streamed."""

    def __init__(self, name: str, command: List[str], cwd: Path, env: Optional[dict] = None):
        self.name = name
        self.command = command
        self.cwd = cwd
        self.env = env or os.environ.copy()
        self.process: Optional[subprocess.Popen] = None
        self._stdout_thread: Optional[threading.Thread] = None
        self._stderr_thread: Optional[threading.Thread] = None
        self._reported = False

    def start(self) -> None:
        print_header(f"Starting {self.name}: {' '.join(self.command)}")
        self.process = subprocess.Popen(
            self.command,
            cwd=str(self.cwd),
            env=self.env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        assert self.process.stdout
        assert self.process.stderr
        self._stdout_thread = threading.Thread(
            target=self._stream_output,
            args=(self.process.stdout, False),
            daemon=True,
        )
        self._stderr_thread = threading.Thread(
            target=self._stream_output,
            args=(self.process.stderr, True),
            daemon=True,
        )
        self._stdout_thread.start()
        self._stderr_thread.start()

    def _stream_output(self, stream, is_err: bool) -> None:
        prefix = f"[{self.name}{'::err' if is_err else ''}] "
        for line in iter(stream.readline, ""):
            print(prefix + line.rstrip())
        stream.close()

    @property
    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    @property
    def returncode(self) -> Optional[int]:
        return None if self.process is None else self.process.poll()

    def stop(self, timeout: float = 10.0) -> None:
        if not self.process:
            return
        if self.is_running:
            print_header(f"Stopping {self.name}...")
            self.process.terminate()
            try:
                self.process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                print_header(f"Force killing {self.name}")
                self.process.kill()
        if self._stdout_thread:
            self._stdout_thread.join(timeout=1)
        if self._stderr_thread:
            self._stderr_thread.join(timeout=1)


class DevEnvironmentOrchestrator:
    """Coordinates Docker + local dev servers."""

    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.compose = ComposeClient(Path(args.compose_file))
        self.processes: List[ManagedProcess] = []
        self._shutdown = False

    def start(self) -> None:
        if not self.args.skip_dex:
            print_header("Ensuring Keycloak container is up (docker compose)...")
            self.compose.up_detached(["keycloak"], rebuild=self.args.rebuild_dex)
            print_header("Keycloak is running on http://localhost:8080")
            print_header("  - Mock GitHub: http://localhost:8080/realms/mock-github")
            print_header("  - Mock Google: http://localhost:8080/realms/mock-google")
            print_header("  - Admin Console: http://localhost:8080 (admin/admin)")

        if not self.args.skip_backend:
            backend_cmd = shlex.split(self.args.backend_command)
            backend_env = os.environ.copy()
            backend_env.setdefault("ENV_TYPE", "DEV")
            backend_proc = ManagedProcess("backend", backend_cmd, ROOT_DIR, backend_env)
            backend_proc.start()
            self.processes.append(backend_proc)

        if not self.args.skip_frontend:
            if not UI_DIR.exists():
                raise FileNotFoundError(f"Frontend directory not found: {UI_DIR}")
            frontend_cmd = shlex.split(self.args.frontend_command)
            frontend_proc = ManagedProcess("frontend", frontend_cmd, UI_DIR)
            frontend_proc.start()
            self.processes.append(frontend_proc)

        if not self.processes:
            print_header("Nothing else to run. Exiting.")
            return

        self._install_signal_handlers()
        print_header("All services started. Press Ctrl+C to stop.")
        self._monitor_processes()

    def _install_signal_handlers(self) -> None:
        def handler(signum, _frame):
            print_header(f"Received signal {signum}; shutting down...")
            self.stop()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                signal.signal(sig, handler)
            except ValueError:
                # Signal handling may fail in some threaded contexts (e.g. Windows)
                pass

    def _monitor_processes(self) -> None:
        try:
            while not self._shutdown:
                for proc in self.processes:
                    if proc.is_running:
                        continue
                    if proc.returncode is not None and not proc._reported:
                        proc._reported = True
                        print_header(
                            f"{proc.name} exited with code {proc.returncode}"  # noqa: SLF001
                        )
                        self._shutdown = True
                        break
                if self._shutdown:
                    break
                time.sleep(0.5)
        except KeyboardInterrupt:
            print_header("Keyboard interrupt received; stopping...")
        finally:
            self.stop()

    def stop(self) -> None:
        if self._shutdown:
            return
        self._shutdown = True
        for proc in self.processes:
            proc.stop()
        if self.args.stop_dex and not self.args.skip_dex:
            print_header("Stopping Keycloak container...")
            self.compose.stop(["keycloak"])
        print_header("All services stopped.")

    def stop_only(self) -> None:
        print_header("Stopping Keycloak service via docker compose...")
        self.compose.stop(["keycloak"])
        print_header("Keycloak stopped. Manually terminate any local dev servers if needed.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Start Keycloak (Docker) plus backend & frontend dev servers with one command.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "action",
        nargs="?",
        choices=["start", "stop"],
        default="start",
        help="What to do: start everything or just stop Keycloak.",
    )
    parser.add_argument(
        "--compose-file",
        default=str(DEFAULT_COMPOSE_FILE),
        help="Path to docker compose file used for Keycloak.",
    )
    parser.add_argument(
        "--backend-command",
        default=DEFAULT_BACKEND_CMD,
        help="Command used to start the backend (runs inside project root).",
    )
    parser.add_argument(
        "--frontend-command",
        default=DEFAULT_FRONTEND_CMD,
        help="Command used to start the frontend (runs inside papers2code-ui).",
    )
    parser.add_argument(
        "--skip-dex",
        action="store_true",
        help="Do not manage the Keycloak Docker container.",
    )
    parser.add_argument(
        "--skip-backend",
        action="store_true",
        help="Do not launch the backend process.",
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="Do not launch the frontend process.",
    )
    parser.add_argument(
        "--rebuild-dex",
        action="store_true",
        help="Rebuild the Keycloak image before starting it (docker compose build).",
    )
    parser.add_argument(
        "--stop-dex",
        action="store_true",
        help="Stop the Keycloak container when shutting down.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        orchestrator = DevEnvironmentOrchestrator(args)
        if args.action == "start":
            orchestrator.start()
        else:
            orchestrator.stop_only()
    except FileNotFoundError as exc:
        print_header(str(exc))
        sys.exit(1)
    except RuntimeError as exc:
        print_header(f"Error: {exc}")
        sys.exit(1)
    except Exception as exc:  # pragma: no cover - safety net
        print_header(f"Unexpected error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
