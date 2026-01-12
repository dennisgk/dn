from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()

PUSHOVER_TOKEN = os.getenv("PUSHOVER_TOKEN", "").strip()
PUSHOVER_USER = os.getenv("PUSHOVER_USER", "").strip()

PUSHOVER_URL = "https://api.pushover.net/1/messages.json"


def send_notification(message: str) -> str:
    """
    Sends a pushover message and returns a response string to store in DB.
    Uses PUSHOVER_TOKEN and PUSHOVER_USER from .env.
    """
    if not PUSHOVER_TOKEN or not PUSHOVER_USER:
        return (
            "Pushover not configured: missing PUSHOVER_TOKEN or PUSHOVER_USER in .env. "
            f"at {datetime.now(timezone.utc).isoformat().replace('+00:00','Z')}"
        )

    payload = {
        "token": PUSHOVER_TOKEN,
        "user": PUSHOVER_USER,
        "message": message,
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(PUSHOVER_URL, data=payload)  # Pushover accepts form-encoded
            # Store useful info for debugging/auditing:
            return f"HTTP {r.status_code}: {r.text}"
    except Exception as e:
        return f"ERROR: {repr(e)}"
