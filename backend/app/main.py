from collections import Counter
from datetime import datetime, timezone
import os
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .auth import AuthenticatedUser, require_user
from .risk_engine import RiskAssessment, RiskEngine, RiskInput, get_risk_engine, severity_bucket
from .schemas import (
    AnalyticsResponse,
    DashboardResponse,
    IncidentAction,
    IncidentCreate,
    IncidentDetail,
    IncidentSummary,
    IncidentUpdate,
)
from .store import (
    StoreUnavailable,
    create_incident,
    get_incident as load_incident,
    list_incidents as load_incidents,
    update_incident,
)


app = FastAPI(
    title="RiskFusion AI API",
    version="3.0.0",
    description="Incident correlation and explainable risk scoring for security operations teams.",
)


def _allowed_origins() -> list[str]:
    """Browser origins permitted to call this API.

    Defaults cover local development plus the deployed site; override with
    ALLOWED_ORIGINS (comma separated) for any other domain.
    """
    configured = os.getenv("ALLOWED_ORIGINS", "")
    if configured.strip():
        return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    return [
        "https://riskfusion-ai.vercel.app",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


# Credentials travel in the Authorization header, never in cookies, so
# allow_credentials stays off while the origin list stays explicit.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_origin_regex=r"^https://riskfusion-ai(-[a-z0-9-]+)?\.vercel\.app$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.exception_handler(StoreUnavailable)
async def store_unavailable_handler(_: Request, exc: StoreUnavailable) -> JSONResponse:
    """Surfaces datastore problems as 503 rather than an opaque 500."""
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "The incident data store is currently unavailable. Please retry shortly."},
    )


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@app.get("/dashboard", response_model=DashboardResponse, tags=["Dashboard"])
def dashboard(user: AuthenticatedUser = Depends(require_user)):
    incidents = load_incidents()
    active = [i for i in incidents if i["status"] not in {"Resolved", "Closed"}]
    trend = Counter(str(i["detected_at"])[:10] for i in incidents)
    distribution = Counter(severity_bucket(i["risk_score"]) for i in incidents)
    order = ["Critical", "High", "Medium", "Low"]
    divisor = len(incidents) or 1
    return {
        "active_incidents": len(active),
        "critical_alerts": sum(
            i["severity"] == "Critical" and i["status"] not in {"Resolved", "Closed"} for i in incidents
        ),
        "average_risk_score": round(sum(i["risk_score"] for i in incidents) / divisor, 1) if incidents else 0.0,
        "ai_confidence": round(sum(i["ai_confidence"] for i in incidents) / divisor, 1) if incidents else 0.0,
        "incident_trend": [{"date": date, "count": count} for date, count in sorted(trend.items())],
        "risk_distribution": [{"severity": item, "count": distribution[item]} for item in order],
    }


@app.get("/incidents", response_model=list[IncidentSummary], tags=["Incidents"])
def list_incidents(user: AuthenticatedUser = Depends(require_user)):
    return load_incidents()


@app.get("/incident/{incident_id}", response_model=IncidentDetail, tags=["Incidents"])
def get_incident(incident_id: str, user: AuthenticatedUser = Depends(require_user)):
    incident = load_incident(incident_id.upper())
    if not incident:
        raise HTTPException(status_code=404, detail="That incident could not be found.")
    return incident


@app.get("/analytics", response_model=AnalyticsResponse, tags=["Analytics"])
def analytics(user: AuthenticatedUser = Depends(require_user)):
    incidents = load_incidents()
    severity = Counter(i["severity"] for i in incidents)
    types = Counter(i["incident_type"] for i in incidents)
    statuses = Counter(i["status"] for i in incidents)
    locations = Counter(i["source_location"] for i in incidents)
    transaction_values = [i["transaction_amount"] for i in incidents if i.get("transaction_amount") is not None]
    divisor = len(incidents) or 1
    return {
        "total_incidents": len(incidents),
        "incidents_by_severity": [
            {"severity": key, "count": severity[key]} for key in ["Critical", "High", "Medium", "Low"]
        ],
        "incidents_by_type": [{"type": key, "count": value} for key, value in types.most_common()],
        "status_breakdown": [{"status": key, "count": value} for key, value in statuses.most_common()],
        "top_risk_locations": [{"location": key, "incidents": value} for key, value in locations.most_common(5)],
        "transaction_risk": {
            "flagged_transaction_count": len(transaction_values),
            "flagged_transaction_value": round(sum(transaction_values), 2),
            "currency": "INR",
        },
        "model_performance": {
            "average_ai_confidence": round(sum(i["ai_confidence"] for i in incidents) / divisor, 1)
            if incidents
            else 0.0,
            "high_confidence_cases": sum(i["ai_confidence"] >= 90 for i in incidents),
            "review_completion_rate": round(
                sum(i["status"] in {"Resolved", "Contained"} for i in incidents) / divisor * 100, 1
            )
            if incidents
            else 0.0,
        },
    }


@app.post("/calculate-risk", response_model=RiskAssessment, tags=["Risk Engine"])
def calculate_risk(
    payload: RiskInput,
    user: AuthenticatedUser = Depends(require_user),
    risk_engine: RiskEngine = Depends(get_risk_engine),
):
    """Explainable Risk Correlation Engine: correlates cybersecurity and
    transaction telemetry into a single scored, explained risk assessment.
    Backed today by a weighted rule engine (app/risk_engine) — swappable for
    an ML/LLM implementation via get_risk_engine() without changing this route."""
    return risk_engine.assess(payload)


@app.post("/incidents", response_model=IncidentDetail, status_code=201, tags=["Incidents"])
def create_new_incident(payload: IncidentCreate, user: AuthenticatedUser = Depends(require_user)):
    now = _now()
    record = payload.model_dump()
    record.update(
        {
            "id": f"INC-{now:%Y%m%d}-{uuid4().hex[:6].upper()}",
            "status": "Open",
            "ai_confidence": 0.0,
            "currency": "INR",
            "detected_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "recommended_actions": [],
            "mitre_techniques": [],
        }
    )
    record["timeline"] = record.get("timeline") or [
        {
            "timestamp": now.isoformat(),
            "event": "Incident created",
            "source": "analyst",
            "detail": f"Raised by {user.label}.",
        }
    ]
    return create_incident(record)


@app.patch("/incident/{incident_id}", response_model=IncidentDetail, tags=["Incidents"])
def edit_incident(
    incident_id: str, payload: IncidentUpdate, user: AuthenticatedUser = Depends(require_user)
):
    changes = {key: value for key, value in payload.model_dump().items() if value is not None}
    if not changes:
        raise HTTPException(status_code=400, detail="No changes were supplied.")

    incident_id = incident_id.upper()
    existing = load_incident(incident_id)
    if not existing:
        raise HTTPException(status_code=404, detail="That incident could not be found.")

    now = _now()
    changes["updated_at"] = now.isoformat()
    # Every state change is appended to the incident's own audit timeline.
    timeline = list(existing.get("timeline") or [])
    described = ", ".join(f"{key.replace('_', ' ')} → {value}" for key, value in changes.items() if key != "updated_at")
    timeline.append(
        {
            "timestamp": now.isoformat(),
            "event": "Incident updated",
            "source": "analyst",
            "detail": f"{described} by {user.label}.",
        }
    )
    changes["timeline"] = timeline

    incident = update_incident(incident_id, changes)
    if not incident:
        raise HTTPException(status_code=404, detail="That incident could not be found.")
    return incident


@app.post("/incident/{incident_id}/actions", response_model=IncidentDetail, tags=["Incidents"])
def record_incident_action(
    incident_id: str, payload: IncidentAction, user: AuthenticatedUser = Depends(require_user)
):
    """Records a response action or analyst note against an incident.

    This is what the workspace's response controls call, so every action an
    analyst takes is persisted to the incident's audit timeline instead of
    only changing the UI.
    """
    incident_id = incident_id.upper()
    existing = load_incident(incident_id)
    if not existing:
        raise HTTPException(status_code=404, detail="That incident could not be found.")

    now = _now()
    timeline = list(existing.get("timeline") or [])
    timeline.append(
        {
            "timestamp": now.isoformat(),
            "event": payload.action,
            "source": payload.source,
            "detail": f"{payload.detail} — recorded by {user.label}.".strip(),
        }
    )
    changes: dict = {"timeline": timeline, "updated_at": now.isoformat()}
    if payload.status:
        changes["status"] = payload.status

    incident = update_incident(incident_id, changes)
    if not incident:
        raise HTTPException(status_code=404, detail="That incident could not be found.")
    return incident


@app.get("/me", tags=["Authentication"])
def me(user: AuthenticatedUser = Depends(require_user)):
    """Identity of the caller, used by the workspace to confirm its session."""
    return {"id": user.id, "email": user.email, "role": user.role}


@app.get("/health", tags=["System"])
def health():
    """Unauthenticated readiness probe. Reports no configuration detail."""
    return {"status": "operational", "service": "RiskFusion AI", "timestamp": datetime.now(timezone.utc).isoformat()}


# Serve the static frontend when running locally so its API requests share the
# FastAPI origin. On Vercel the static files are served by the platform.
frontend_root = Path(__file__).resolve().parents[2]
if (frontend_root / "index.html").exists():
    app.mount("/", StaticFiles(directory=frontend_root, html=True), name="frontend")
