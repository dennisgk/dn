from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Literal, Tuple

from validators import string_min_length, utc_datetime_in_future, parse_utc_datetime


ArgType = Literal["DATETIME", "TEXT", "TEXTAREA", "INTEGER", "FLOAT", "BOOLEAN"]


@dataclass(frozen=True)
class ArgSpec:
    type: ArgType
    label: str
    desc: str


@dataclass(frozen=True)
class NotificationType:
    type: str
    arguments: List[ArgSpec]
    validator: Callable[[List[Any]], Tuple[bool, str]]
    handler: Callable[[str, List[Any]], List[Tuple[str, str]]]  # (utc_datetime, content)


def _validate_once(args: List[Any]) -> Tuple[bool, str]:
    if len(args) != 2:
        return False, "ONCE requires exactly 2 arguments."
    ok, msg = utc_datetime_in_future(args[0])
    if not ok:
        return False, msg
    ok, msg = string_min_length(1)(args[1])
    if not ok:
        return False, msg
    return True, ""


def _handler_once(uuid: str, args: List[Any]) -> List[Tuple[str, str]]:
    # args: [utc_datetime_str, message_str]
    dt = str(args[0]).strip()
    msg = str(args[1])
    return [(dt, msg)]

def _validate_30_min_before_repeat(args: List[Any]) -> Tuple[bool, str]:
    if len(args) != 2:
        return False, "30_MIN_BEFORE_REPEAT requires exactly 2 arguments."

    ok, msg = utc_datetime_in_future(args[0])
    if not ok:
        return False, msg

    ok, msg = string_min_length(1)(args[1])
    if not ok:
        return False, msg

    # Optional: require the target time to be at least 5 minutes in the future
    dt = parse_utc_datetime(str(args[0]))
    if not dt:
        return False, "Invalid DATETIME."
    now = datetime.now(timezone.utc)
    if dt <= now + timedelta(minutes=1):
        return False, "Target time must be at least 1 minute in the future (UTC)."

    return True, ""


def _handler_30_min_before_repeat(uuid: str, args: List[Any]) -> List[Tuple[str, str]]:
    # args: [target_utc_datetime_str, message_str]
    target_str = str(args[0]).strip()
    msg = str(args[1])

    target_dt = parse_utc_datetime(target_str)
    if not target_dt:
        return []

    # 30,25,20,15,10,5 minutes before target (6 total)
    offsets = [30, 25, 20, 15, 10, 5]

    out: List[Tuple[str, str]] = []
    for m in offsets:
        t = (target_dt - timedelta(minutes=m)).astimezone(timezone.utc)
        t_str = t.isoformat().replace("+00:00", "Z")
        out.append((t_str, msg))

    # Sort earliest -> latest
    out.sort(key=lambda x: x[0])
    return out


_TYPES: List[NotificationType] = [
    NotificationType(
        type="ONCE",
        arguments=[
            ArgSpec(type="DATETIME", label="Send time (UTC)", desc="UTC ISO time; client will send UTC."),
            ArgSpec(type="TEXTAREA", label="Message", desc="Notification content to send."),
        ],
        validator=_validate_once,
        handler=_handler_once,
    ),
    NotificationType(
        type="30_MIN_BEFORE_REPEAT",
        arguments=[
            ArgSpec(type="DATETIME", label="Target time (UTC)", desc="We will send reminders before this UTC time."),
            ArgSpec(type="TEXTAREA", label="Message", desc="Content to send for each reminder."),
        ],
        validator=_validate_30_min_before_repeat,
        handler=_handler_30_min_before_repeat,
    ),
]


def info() -> List[Dict[str, Any]]:
    # /api/create_info expects {type, arguments:[{type,label,desc}] }[]
    out: List[Dict[str, Any]] = []
    for t in _TYPES:
        out.append(
            {
                "type": t.type,
                "arguments": [{"type": a.type, "label": a.label, "desc": a.desc} for a in t.arguments],
            }
        )
    return out


def get_type(type_name: str) -> NotificationType | None:
    for t in _TYPES:
        if t.type == type_name:
            return t
    return None


def validate(payload: Dict[str, Any]) -> Tuple[bool, str]:
    if not isinstance(payload, dict):
        return False, "Body must be an object."
    ntype = payload.get("type")
    args = payload.get("arguments")
    if not isinstance(ntype, str) or not ntype:
        return False, "Missing or invalid 'type'."
    if not isinstance(args, list):
        return False, "Missing or invalid 'arguments' (must be an array)."

    t = get_type(ntype)
    if not t:
        return False, f"Unknown type '{ntype}'."

    # Basic type-shape validation by ArgSpec:
    if len(args) != len(t.arguments):
        return False, f"Expected {len(t.arguments)} arguments for {ntype}."

    for i, spec in enumerate(t.arguments):
        v = args[i]
        if spec.type in ("TEXT", "TEXTAREA", "DATETIME"):
            if not isinstance(v, str):
                return False, f"Argument {i+1} ({spec.label}) must be a string."
        elif spec.type == "INTEGER":
            if not isinstance(v, int):
                return False, f"Argument {i+1} ({spec.label}) must be an integer."
        elif spec.type == "FLOAT":
            if not isinstance(v, (int, float)):
                return False, f"Argument {i+1} ({spec.label}) must be a number."
        elif spec.type == "BOOLEAN":
            if not isinstance(v, bool):
                return False, f"Argument {i+1} ({spec.label}) must be a boolean."

    ok, msg = t.validator(args)
    if not ok:
        return False, msg
    return True, ""
