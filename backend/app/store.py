"""Shared Supabase-backed incident store for the deployed demo."""
import json
import os
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://njepfasjoaomxgpxvjbx.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZXBmYXNqb2FvbXhncHh2amJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTA5MDQsImV4cCI6MjEwMDQ2NjkwNH0.pGo6LgCm8VPdim_LF8yaTDk8m13crwaOpfglTJ2q39E")


def request(method: str, path: str, payload: dict | None = None):
    headers = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}", "Content-Type": "application/json"}
    if method in {"POST", "PATCH"}:
        headers["Prefer"] = "return=representation"
    body = json.dumps(payload, default=str).encode() if payload is not None else None
    req = Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=8) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        raise RuntimeError(f"Supabase request failed: {exc.code} {exc.read().decode()}") from exc


def list_incidents():
    return request("GET", "incidents?select=*&order=detected_at.desc")


def get_incident(incident_id: str):
    rows = request("GET", f"incidents?select=*&id=eq.{quote(incident_id)}")
    return rows[0] if rows else None


def create_incident(record: dict):
    return request("POST", "incidents", record)[0]


def update_incident(incident_id: str, changes: dict):
    rows = request("PATCH", f"incidents?id=eq.{quote(incident_id)}", changes)
    return rows[0] if rows else None
