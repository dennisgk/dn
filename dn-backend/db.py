from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "db.sqlite"


def ensure_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
              uuid TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              arguments_json TEXT NOT NULL,
              active_status INTEGER NOT NULL DEFAULT 1,
              created_utc TEXT NOT NULL
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS past_sends (
              uuid TEXT NOT NULL,
              utc_datetime TEXT NOT NULL,
              content TEXT NOT NULL,
              pushover_response TEXT NOT NULL,
              PRIMARY KEY (uuid, utc_datetime)
            )
            """
        )
        con.commit()


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.close()


def insert_notification(uuid: str, ntype: str, arguments: list[Any], created_utc: str) -> None:
    with connect() as con:
        con.execute(
            "INSERT INTO notifications (uuid, type, arguments_json, active_status, created_utc) VALUES (?, ?, ?, 1, ?)",
            (uuid, ntype, json.dumps(arguments), created_utc),
        )
        con.commit()


def get_notification(uuid: str) -> Optional[Dict[str, Any]]:
    with connect() as con:
        row = con.execute("SELECT * FROM notifications WHERE uuid = ?", (uuid,)).fetchone()
        if not row:
            return None
        return {
            "uuid": row["uuid"],
            "type": row["type"],
            "arguments": json.loads(row["arguments_json"]),
            "active_status": bool(row["active_status"]),
            "created_utc": row["created_utc"],
        }


def list_notifications(active_only: bool = False) -> list[Dict[str, Any]]:
    with connect() as con:
        if active_only:
            rows = con.execute("SELECT * FROM notifications WHERE active_status = 1").fetchall()
        else:
            rows = con.execute("SELECT * FROM notifications").fetchall()
        out: list[Dict[str, Any]] = []
        for r in rows:
            out.append(
                {
                    "uuid": r["uuid"],
                    "type": r["type"],
                    "arguments": json.loads(r["arguments_json"]),
                    "active_status": bool(r["active_status"]),
                    "created_utc": r["created_utc"],
                }
            )
        return out


def set_notification_active(uuid: str, active: bool) -> None:
    with connect() as con:
        con.execute("UPDATE notifications SET active_status = ? WHERE uuid = ?", (1 if active else 0, uuid))
        con.commit()


def delete_notification(uuid: str) -> None:
    with connect() as con:
        con.execute("DELETE FROM notifications WHERE uuid = ?", (uuid,))
        con.execute("DELETE FROM past_sends WHERE uuid = ?", (uuid,))
        con.commit()


def has_past_send(uuid: str, utc_datetime: str) -> bool:
    with connect() as con:
        row = con.execute(
            "SELECT 1 FROM past_sends WHERE uuid = ? AND utc_datetime = ?",
            (uuid, utc_datetime),
        ).fetchone()
        return row is not None


def insert_past_send(uuid: str, utc_datetime: str, content: str, pushover_response: str) -> None:
    with connect() as con:
        con.execute(
            "INSERT OR IGNORE INTO past_sends (uuid, utc_datetime, content, pushover_response) VALUES (?, ?, ?, ?)",
            (uuid, utc_datetime, content, pushover_response),
        )
        con.commit()


def list_past_sends(uuid: Optional[str] = None) -> list[Dict[str, Any]]:
    with connect() as con:
        if uuid:
            rows = con.execute(
                "SELECT * FROM past_sends WHERE uuid = ? ORDER BY utc_datetime ASC",
                (uuid,),
            ).fetchall()
        else:
            rows = con.execute("SELECT * FROM past_sends ORDER BY utc_datetime ASC").fetchall()
        return [
            {
                "uuid": r["uuid"],
                "utc_datetime": r["utc_datetime"],
                "content": r["content"],
                "pushover_response": r["pushover_response"],
            }
            for r in rows
        ]
