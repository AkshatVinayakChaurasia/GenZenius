from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

AuthMethod = Literal["Password", "OTP", "MFA", "Biometric", "SSO"]
Severity = Literal["Critical", "High", "Medium", "Low"]


class RiskInput(BaseModel):
    """Raw telemetry the risk engine correlates into a single assessment."""

    login_city: str = Field(..., description="City the login being assessed originated from.")
    previous_login_city: Optional[str] = Field(None, description="City of the customer's prior known login.")
    login_timestamp: datetime
    previous_login_timestamp: Optional[datetime] = None

    failed_login_attempts: int = 0
    vpn_detected: bool = False

    new_device: bool = False
    trusted_device: bool = False

    transaction_amount: Optional[float] = None
    customer_avg_transaction_amount: Optional[float] = Field(
        None, description="Customer's historical average transaction amount, used as a behavioural baseline."
    )

    new_beneficiary: bool = False
    high_risk_merchant: bool = False

    auth_method: AuthMethod = "Password"
    behavior_deviation_score: Optional[float] = Field(
        None, ge=0, le=1, description="0-1 anomaly score of this session vs the customer's behavioural history."
    )


class SignalMatch(BaseModel):
    name: str
    weight: int
    detail: str
    severity: Severity


class RiskAssessment(BaseModel):
    risk_score: int
    confidence: float
    severity: Severity
    signals: list[str]
    signal_details: list[SignalMatch]
    reason: str
    recommended_actions: list[str]
