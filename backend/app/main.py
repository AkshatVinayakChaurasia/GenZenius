from collections import Counter
from datetime import datetime, timezone
import hmac
import os
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .risk_engine import RiskAssessment, RiskEngine, RiskInput, get_risk_engine, severity_bucket
from .schemas import AnalyticsResponse, DashboardResponse, IncidentCreate, IncidentDetail, IncidentSummary, IncidentUpdate
from .store import create_incident, get_incident as load_incident, list_incidents as load_incidents, update_incident


app = FastAPI(title="RiskFusion AI API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


@app.get("/dashboard", response_model=DashboardResponse, tags=["Dashboard"])
def dashboard():
    incidents = load_incidents()
    active = [i for i in incidents if i.status not in {"Resolved", "Closed"}]
    trend = Counter(i.detected_at.date().isoformat() for i in incidents)
    distribution = Counter(severity_bucket(i.risk_score) for i in incidents)
    order = ["Critical", "High", "Medium", "Low"]
    divisor = len(incidents) or 1
    return {
        "active_incidents": len(active),
        "critical_alerts": sum(i.severity == "Critical" and i.status not in {"Resolved", "Closed"} for i in incidents),
        "average_risk_score": round(sum(i.risk_score for i in incidents) / divisor, 1) if incidents else 0.0,
        "ai_confidence": round(sum(i.ai_confidence for i in incidents) / divisor, 1) if incidents else 0.0,
        "incident_trend": [{"date": date, "count": count} for date, count in sorted(trend.items())],
        "risk_distribution": [{"severity": item, "count": distribution[item]} for item in order],
    }


@app.get("/incidents", response_model=list[IncidentSummary], tags=["Incidents"])
def list_incidents():
    return load_incidents()


@app.get("/incident/{incident_id}", response_model=IncidentDetail, tags=["Incidents"])
def get_incident(incident_id: str):
    incident = load_incident(incident_id.upper())
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' was not found")
    return incident


@app.get("/analytics", response_model=AnalyticsResponse, tags=["Analytics"])
def analytics():
    incidents = load_incidents()
    severity = Counter(i.severity for i in incidents)
    types = Counter(i.incident_type for i in incidents)
    statuses = Counter(i.status for i in incidents)
    locations = Counter(i.source_location for i in incidents)
    transaction_values = [i.transaction_amount for i in incidents if i.transaction_amount is not None]
    divisor = len(incidents) or 1
    return {
        "total_incidents": len(incidents),
        "incidents_by_severity": [{"severity": key, "count": severity[key]} for key in ["Critical", "High", "Medium", "Low"]],
        "incidents_by_type": [{"type": key, "count": value} for key, value in types.most_common()],
        "status_breakdown": [{"status": key, "count": value} for key, value in statuses.most_common()],
        "top_risk_locations": [{"location": key, "incidents": value} for key, value in locations.most_common(5)],
        "transaction_risk": {"flagged_transaction_count": len(transaction_values), "flagged_transaction_value": round(sum(transaction_values), 2), "currency": "INR"},
        "model_performance": {
            "average_ai_confidence": round(sum(i.ai_confidence for i in incidents) / divisor, 1) if incidents else 0.0,
            "high_confidence_cases": sum(i.ai_confidence >= 90 for i in incidents),
            "review_completion_rate": round(sum(i.status in {"Resolved", "Contained"} for i in incidents) / divisor * 100, 1) if incidents else 0.0,
        },
    }


@app.post("/calculate-risk", response_model=RiskAssessment, tags=["Risk Engine"])
def calculate_risk(payload: RiskInput, risk_engine: RiskEngine = Depends(get_risk_engine)):
    """Explainable Risk Correlation Engine: correlates cybersecurity and
    transaction telemetry into a single scored, explained risk assessment.
    Backed today by a weighted rule engine (app/risk_engine) — swappable for
    an ML/LLM implementation via get_risk_engine() without changing this route."""
    return risk_engine.assess(payload)


@app.post("/incidents", response_model=IncidentDetail, status_code=201, tags=["Incidents"])
def create_new_incident(payload: IncidentCreate):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    record = payload.model_dump()
    record.update({
        "id": f"INC-{now:%Y%m%d}-{uuid4().hex[:6].upper()}", "status": "Open",
        "ai_confidence": 0.0, "currency": "INR", "detected_at": now.isoformat(), "updated_at": now.isoformat(),
        "recommended_actions": [], "mitre_techniques": [],
    })
    return create_incident(record)


@app.patch("/incident/{incident_id}", response_model=IncidentDetail, tags=["Incidents"])
def edit_incident(incident_id: str, payload: IncidentUpdate):
    changes = {key: value for key, value in payload.model_dump().items() if value is not None}
    changes["updated_at"] = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    incident = update_incident(incident_id.upper(), changes)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' was not found")
    return incident


@app.post("/auth/login", tags=["Authentication"])
def login(credentials: dict):
    # Demo access is deliberately strong and configurable.  Keeping this check
    # server-side also means weak legacy credentials can never authenticate.
    username = os.getenv("DEMO_USERNAME", "demo.admin")
    password = os.getenv("DEMO_PASSWORD", "RiskFusion@2026!")
    if hmac.compare_digest(str(credentials.get("username", "")), username) and hmac.compare_digest(str(credentials.get("password", "")), password):
        return {"authenticated": True, "username": username, "display_name": "Demo Administrator"}
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.get("/health", tags=["System"])
def health():
    """Small, cache-safe readiness probe used by the demo UI and deployment."""
    return {"status": "operational", "service": "RiskFusion AI", "timestamp": datetime.now(timezone.utc).isoformat()}


# Serve the unchanged static frontend during local demos so its API requests
# share the FastAPI origin. Vercel continues to serve the static files itself.
frontend_root = Path(__file__).resolve().parents[2]
app.mount("/", StaticFiles(directory=frontend_root, html=True), name="frontend")
