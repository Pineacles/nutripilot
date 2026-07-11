"""Per-user day-boundary resolution.

``date.today()`` uses the server's clock (UTC in production), so entries logged
late in the evening or after midnight land on the wrong calendar day for users
in other timezones. ``today_for(user)`` resolves "today" in the user's own
configured timezone instead.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)


def today_utc() -> date:
    """Today's date in UTC (server-neutral fallback when no user tz applies)."""
    return datetime.now(timezone.utc).date()


def today_for(user) -> date:
    """Today's date in the user's configured timezone.

    Falls back to UTC if the user has no timezone or the stored string is not a
    valid IANA zone name.
    """
    tz_name = getattr(user, "timezone", None)
    if not tz_name:
        return today_utc()
    try:
        return datetime.now(ZoneInfo(tz_name)).date()
    except (ZoneInfoNotFoundError, ValueError, OSError):
        logger.warning("Invalid timezone %r for user; falling back to UTC.", tz_name)
        return today_utc()
