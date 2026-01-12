from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

import create as create_mod
import db
import pushover
from validators import parse_utc_datetime


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


async def _runner_loop(stop_event: asyncio.Event) -> None:
    # Every 60 seconds: run active notification handlers and send due messages
    while not stop_event.is_set():
        try:
            run_and_send_due()
        except Exception as e:
            print("[runner] error:", repr(e))

        # Sleep up to 60s, but wake early if stopping
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=60)
        except asyncio.TimeoutError:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.ensure_db()

    stop_event = asyncio.Event()
    task = asyncio.create_task(_runner_loop(stop_event))

    try:
        yield
    finally:
        stop_event.set()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dn.kountouris.org"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_and_send_due() -> None:
    active = db.list_notifications(active_only=True)
    if not active:
        return

    now = datetime.now(timezone.utc)

    due_contents: List[str] = []
    due_markers: List[tuple[str, str, str]] = []  # (uuid, utc_datetime, content)

    for n in active:
        uuid = n["uuid"]
        ntype = n["type"]
        args = n["arguments"]

        t = create_mod.get_type(ntype)
        if not t:
            db.set_notification_active(uuid, False)
            continue

        schedule = t.handler(uuid, args)
        if not schedule:
            db.set_notification_active(uuid, False)
            continue

        due_for_this_notification: List[tuple[str, str]] = []
        for utc_dt_str, content in schedule:
            dt = parse_utc_datetime(utc_dt_str)
            if not dt:
                continue
            if dt <= now and not db.has_past_send(uuid, utc_dt_str):
                due_for_this_notification.append((utc_dt_str, content))

        if due_for_this_notification:
            utc_dt_str, content = sorted(due_for_this_notification, key=lambda x: x[0])[0]
            due_contents.append(content)
            due_markers.append((uuid, utc_dt_str, content))

        # Deactivate if everything is already past+sent
        all_past_sent = True
        for utc_dt_str, _ in schedule:
            dt = parse_utc_datetime(utc_dt_str)
            if not dt:
                continue
            if dt > now or not db.has_past_send(uuid, utc_dt_str):
                all_past_sent = False
                break
        if all_past_sent:
            db.set_notification_active(uuid, False)

    if not due_contents:
        return

    message = "\n".join(due_contents)
    resp = pushover.send_notification(message)

    for uuid, utc_dt_str, content in due_markers:
        db.insert_past_send(uuid, utc_dt_str, content, resp)


# ---- routes (same as before) ----

@app.get("/api/create_info")
def create_info() -> List[Dict[str, Any]]:
    return create_mod.info()


@app.post("/api/create")
async def create(request: Request) -> Dict[str, Any]:
    payload = await request.json()
    ok, msg = create_mod.validate(payload)
    if not ok:
        return {"ok": False, "message": msg}

    ntype = payload["type"]
    args = payload["arguments"]

    new_uuid = str(uuid4())
    db.insert_notification(new_uuid, ntype, args, _utc_now_iso())
    return {"ok": True, "uuid": new_uuid}


@app.get("/api/info")
def info(uuid: str = Query(...)) -> Dict[str, Any]:
    n = db.get_notification(uuid)
    if not n:
        raise HTTPException(status_code=404, detail="UUID not found.")

    t = create_mod.get_type(n["type"])
    schedule_rows: List[Dict[str, Any]] = []
    if t and n["active_status"]:
        schedule = t.handler(n["uuid"], n["arguments"])
        for utc_dt, content in schedule:
            schedule_rows.append(
                {"name": n["type"], "uuid": n["uuid"], "content": content, "utc_datetime": utc_dt}
            )

    past = db.list_past_sends(uuid=uuid)
    past_rows = [
        {"name": f"{n['type']} (sent)", "uuid": p["uuid"], "content": p["content"], "utc_datetime": p["utc_datetime"]}
        for p in past
    ]

    rows = sorted(past_rows + schedule_rows, key=lambda r: r["utc_datetime"])

    return {"ok": True, "notification": n, "rows": rows}


@app.get("/api/delete")
def delete(uuid: str = Query(...)) -> Dict[str, Any]:
    n = db.get_notification(uuid)
    if not n:
        return {"ok": False, "message": "UUID not found."}
    db.delete_notification(uuid)
    return {"ok": True}


@app.get("/api/list")
def list_api(uuid: Optional[str] = None) -> List[Dict[str, Any]]:
    notifs = db.list_notifications(active_only=False)
    past = db.list_past_sends(uuid=uuid)

    rows: List[Dict[str, Any]] = []
    for p in past:
        rows.append({"name": "sent", "uuid": p["uuid"], "content": p["content"], "utc_datetime": p["utc_datetime"]})

    for n in notifs:
        if uuid and n["uuid"] != uuid:
            continue
        if not n["active_status"]:
            continue
        t = create_mod.get_type(n["type"])
        if not t:
            continue
        schedule = t.handler(n["uuid"], n["arguments"])
        for utc_dt, content in schedule:
            rows.append({"name": n["type"], "uuid": n["uuid"], "content": content, "utc_datetime": utc_dt})

    rows.sort(key=lambda r: r["utc_datetime"])
    return rows

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Serve static files
app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")

# Root → static/index.html
@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")