from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, Tuple


def parse_utc_datetime(dt_str: str) -> Optional[datetime]:
    # Expect ISO 8601; allow trailing Z
    try:
        s = dt_str.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            # Treat naive as UTC
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def utc_datetime_in_future(value: Any) -> Tuple[bool, str]:
    if not isinstance(value, str):
        return False, "DATETIME must be a UTC ISO string."
    dt = parse_utc_datetime(value)
    if not dt:
        return False, "Invalid DATETIME format. Use ISO 8601 UTC (e.g. 2026-01-12T21:30:00Z)."
    now = datetime.now(timezone.utc)
    if dt <= now:
        return False, "DATETIME must be in the future (UTC)."
    return True, ""


def string_min_length(min_len: int):
    def _v(value: Any) -> Tuple[bool, str]:
        if not isinstance(value, str):
            return False, "Value must be a string."
        if len(value.strip()) < min_len:
            return False, f"String must be at least {min_len} characters."
        return True, ""

    return _v

def int_min_value(min_value: int):
    def _v(value: Any) -> Tuple[bool, str]:
        if not isinstance(value, int):
            return False, "Value must be an integer."
        if value < min_value:
            return False, f"Integer must be >= {min_value}."
        return True, ""
    return _v