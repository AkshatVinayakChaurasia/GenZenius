from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Signal(BaseModel):
    name: str
    risk_contribution: int = Field(ge=0, le=100)
    detail: str
    observed_at: datetime


class TimelineEvent(BaseModel):
    timestamp: datetime
    event: str
    source: str
    detail: str


class IncidentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    incident_type: str
    severity: str
    status: str
    risk_score: int
    ai_confidence: float
    customer_name: str
    customer_id: str
    bank: str
    source_location: str
    detected_at: datetime
    updated_at: datetime
    transaction_amount: float | None
    currency: str
    assigned_to: str | None = None


class IncidentDetail(IncidentSummary):
    description: str
    signals: list[Signal]
    timeline: list[TimelineEvent]
    recommended_actions: list[str]
    mitre_techniques: list[str]


class DashboardResponse(BaseModel):
    active_incidents: int
    critical_alerts: int
    average_risk_score: float
    ai_confidence: float
    incident_trend: list[dict]
    risk_distribution: list[dict]


class AnalyticsResponse(BaseModel):
    total_incidents: int
    incidents_by_severity: list[dict]
    incidents_by_type: list[dict]
    status_breakdown: list[dict]
    top_risk_locations: list[dict]
    transaction_risk: dict
    model_performance: dict


class IncidentCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    incident_type: str = Field(min_length=3, max_length=80)
    severity: str = "Medium"
    customer_name: str = "Unknown"
    customer_id: str = "Unassigned"
    bank: str = "Unassigned"
    source_location: str = "Unknown"
    description: str = "Submitted by an analyst."
    risk_score: int = Field(default=50, ge=0, le=100)
    transaction_amount: float | None = None
    signals: list[dict] = Field(default_factory=list)
    timeline: list[dict] = Field(default_factory=list)


class IncidentUpdate(BaseModel):
    status: str | None = None
    severity: str | None = None
    assigned_to: str | None = None


class IncidentAction(BaseModel):
    """A response action or analyst note appended to an incident's timeline."""

    action: str = Field(min_length=2, max_length=120)
    detail: str = Field(default="", max_length=1000)
    source: str = Field(default="analyst", max_length=60)
    status: str | None = Field(default=None, max_length=32)
