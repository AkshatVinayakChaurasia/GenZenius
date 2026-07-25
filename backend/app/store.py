"""Supabase-backed incident store.

The API is the only component permitted to read or write ``public.incidents``.
It authenticates to PostgREST with the service_role key, which bypasses Row
Level Security — so RLS can deny the anon role outright and the table is never
reachable from a browser. That key must only ever exist in the server
environment; there is deliberately no default value for it here.
"""
from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
# Falls back to the anon key only so local development works before a
# service_role key is configured; production must set SUPABASE_SERVICE_ROLE_KEY.
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")

REQUEST_TIMEOUT_SECONDS = 8


class StoreUnavailable(RuntimeError):
    """Raised when the incident store cannot service a request."""


def request(method: str, path: str, payload: dict | list | None = None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise StoreUnavailable(
            "The incident store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if method in {"POST", "PATCH"}:
        headers["Prefer"] = "return=representation"

    body = json.dumps(payload, default=str).encode() if payload is not None else None
    req = Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        # PostgREST error bodies can echo query fragments; keep them out of the
        # client-facing message and surface a stable, generic failure instead.
        detail = exc.read().decode(errors="replace")[:500]
        raise StoreUnavailable(f"Incident store rejected the request ({exc.code}): {detail}") from exc
    except (URLError, TimeoutError) as exc:
        raise StoreUnavailable("Incident store is unreachable.") from exc


def list_incidents():
    return request("GET", "incidents?select=*&order=detected_at.desc") or []


def get_incident(incident_id: str):
    rows = request("GET", f"incidents?select=*&id=eq.{quote(incident_id, safe='')}")
    return rows[0] if rows else None


def create_incident(record: dict):
    rows = request("POST", "incidents", record)
    if not rows:
        raise StoreUnavailable("Incident store did not return the created incident.")
    return rows[0]


def update_incident(incident_id: str, changes: dict):
    rows = request("PATCH", f"incidents?id=eq.{quote(incident_id, safe='')}", changes)
    return rows[0] if rows else None
