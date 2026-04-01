"""Secure structured logging for the integration sync layer.

Design principles (from OWASP, Stripe, Cloudflare patterns):
- Logs reference entities by opaque ID only — never PII, tokens, or health data.
- A redaction filter runs at the formatter level so developers can't bypass it.
- Every sync run gets a correlation ``sync_id`` that ties all steps together.
- JSON-lines output: greppable, parseable by jq / Datadog / Loki / CloudWatch.
- RotatingFileHandler keeps disk usage bounded (~25 MB max).

Usage::

    from app.services.integration_logger import SyncLogger

    with SyncLogger(integration) as log:
        log.info("token_refresh_ok", attempt=1, expires_in=10800)
        log.warning("fetch_partial", records=5, skipped=2)
        log.error("sync_failed", error_type="permanent", provider_code=293)
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.models.integration import Integration

# ───────────────────────────────────────────────────────────────
# Redaction
# ───────────────────────────────────────────────────────────────

_REDACT_KEYS = frozenset({
    "token", "access_token", "refresh_token", "api_key", "apikey",
    "password", "passwd", "secret", "client_secret",
    "authorization", "auth_header", "cookie", "session_id",
    "email", "phone", "address", "name", "first_name", "last_name",
    "credit_card", "card_number", "cvv", "ssn",
})

_SECRET_PATTERNS = [
    re.compile(r"eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}"),           # JWTs / OAuth access tokens
    re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),      # email addresses
    re.compile(r"(?:sk|pk)_(live|test)_[a-zA-Z0-9]{24,}"),               # Stripe-style keys
    re.compile(r"ghp_[a-zA-Z0-9]{36,}"),                                 # GitHub PATs
    re.compile(r"ya29\.[a-zA-Z0-9_-]{50,}"),                             # Google OAuth tokens
]

_REDACTED = "[REDACTED]"


def _redact_string(value: str) -> str:
    """Scrub secret-shaped patterns from a string value."""
    for pattern in _SECRET_PATTERNS:
        value = pattern.sub(_REDACTED, value)
    return value


def _redact_dict(d: dict) -> dict:
    """Recursively redact sensitive keys and secret-shaped values."""
    cleaned: dict[str, Any] = {}
    for key, value in d.items():
        lower = key.lower().replace("-", "_").replace(" ", "_")
        if lower in _REDACT_KEYS:
            cleaned[key] = _REDACTED
        elif isinstance(value, str):
            cleaned[key] = _redact_string(value)
        elif isinstance(value, dict):
            cleaned[key] = _redact_dict(value)
        else:
            cleaned[key] = value
    return cleaned


# ───────────────────────────────────────────────────────────────
# JSON formatter
# ───────────────────────────────────────────────────────────────

class _JSONFormatter(logging.Formatter):
    """Emit one JSON object per log line with automatic redaction."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }

        # Merge structured fields from ``extra``
        for key in ("sync_id", "user_id", "integration_id", "provider",
                     "attempt", "error_type", "provider_code", "http_status",
                     "duration_ms", "records", "detail", "expires_in",
                     "status_from", "status_to", "next_retry", "skipped",
                     "upserted", "reason"):
            value = getattr(record, key, None)
            if value is not None:
                entry[key] = value

        # Redact the whole entry before serialising
        entry = _redact_dict(entry)
        return json.dumps(entry, default=str)


# ───────────────────────────────────────────────────────────────
# Setup (call once at app startup)
# ───────────────────────────────────────────────────────────────

_LOGGER_NAME = "integrations"
_setup_done = False


def setup_integration_logging(
    log_dir: str | Path = "logs",
    max_bytes: int = 5 * 1024 * 1024,  # 5 MB per file
    backup_count: int = 5,             # keep 5 rotated files (~25 MB total)
) -> None:
    """Initialise the integration logger with file + console handlers."""
    global _setup_done
    if _setup_done:
        return
    _setup_done = True

    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(_LOGGER_NAME)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False  # don't duplicate into root logger

    formatter = _JSONFormatter()

    # File handler — JSON lines, rotated
    fh = RotatingFileHandler(
        log_path / "integrations.log",
        maxBytes=max_bytes,
        backupCount=backup_count,
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(formatter)
    logger.addHandler(fh)

    # Console handler — same JSON, only WARNING+ to keep stdout clean
    ch = logging.StreamHandler()
    ch.setLevel(logging.WARNING)
    ch.setFormatter(formatter)
    logger.addHandler(ch)


# ───────────────────────────────────────────────────────────────
# SyncLogger — context manager for a single sync run
# ───────────────────────────────────────────────────────────────

class SyncLogger:
    """Scoped logger for a single integration sync run.

    Automatically attaches ``sync_id``, ``user_id``, ``integration_id``,
    and ``provider`` to every log call.  Tracks duration and logs
    ``sync_start`` / ``sync_complete`` / ``sync_failed`` events.

    Usage::

        with SyncLogger(integration) as log:
            log.info("token_refresh_ok", attempt=1)
            # ... do work ...
        # sync_complete logged automatically with duration
    """

    def __init__(self, integration: Integration) -> None:
        fm = integration.field_mapping or {}
        self._base_extra = {
            "sync_id": f"s_{uuid.uuid4().hex[:12]}",
            "user_id": str(integration.user_id)[:8],  # truncated — enough to filter, not PII
            "integration_id": str(integration.id)[:8],
            "provider": fm.get("source_label", fm.get("type", "unknown")),
        }
        self._logger = logging.getLogger(_LOGGER_NAME)
        self._start: float = 0.0
        self._failed: bool = False
        self._fail_reason: str = ""

    # — Convenience log methods —

    def _log(self, level: int, event: str, **kwargs: Any) -> None:
        extra = {**self._base_extra, **kwargs}
        self._logger.log(level, event, extra=extra)

    def debug(self, event: str, **kwargs: Any) -> None:
        self._log(logging.DEBUG, event, **kwargs)

    def info(self, event: str, **kwargs: Any) -> None:
        self._log(logging.INFO, event, **kwargs)

    def warning(self, event: str, **kwargs: Any) -> None:
        self._log(logging.WARNING, event, **kwargs)

    def error(self, event: str, **kwargs: Any) -> None:
        self._log(logging.ERROR, event, **kwargs)

    # — Context manager —

    def __enter__(self) -> SyncLogger:
        self._start = time.monotonic()
        self.info("sync_start")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        duration_ms = int((time.monotonic() - self._start) * 1000)
        if exc_type is not None:
            self.error("sync_failed", duration_ms=duration_ms,
                       reason=f"unhandled: {exc_type.__name__}: {exc_val}")
            return False  # re-raise
        if self._failed:
            self.error("sync_failed", duration_ms=duration_ms, reason=self._fail_reason)
        else:
            self.info("sync_complete", duration_ms=duration_ms)
        return False

    def mark_failed(self, reason: str) -> None:
        """Mark this sync as failed (logged on context exit)."""
        self._failed = True
        self._fail_reason = reason

    @property
    def sync_id(self) -> str:
        return self._base_extra["sync_id"]
