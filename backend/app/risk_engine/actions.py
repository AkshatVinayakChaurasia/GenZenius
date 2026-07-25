from .models import SignalMatch

# Actions triggered by a specific correlated signal, applied before the
# generic severity-level actions below (deduplicated, order preserved).
SIGNAL_ACTIONS: dict[str, str] = {
    "Impossible Travel": "Force Re-Authentication",
    "VPN Detected": "Block VPN Exit Node",
    "New Device": "Verify Device via OTP",
    "High Value Transaction": "Freeze Transaction",
    "New Beneficiary": "Lock Beneficiary",
    "Failed Login Burst": "Temporarily Lock Account",
    "High-Risk Merchant": "Escalate to Fraud Team",
    "Behavioral Anomaly": "Flag for Analyst Review",
}

SEVERITY_BASE_ACTIONS: dict[str, list[str]] = {
    "Critical": ["Require MFA", "Notify SOC"],
    "High": ["Require MFA", "Flag for Analyst Review"],
    "Medium": ["Monitor Session"],
    "Low": ["Log for Audit Trail"],
}


def recommend_actions(severity: str, signals: list[SignalMatch]) -> list[str]:
    actions: list[str] = []
    for signal in signals:
        action = SIGNAL_ACTIONS.get(signal.name)
        if action and action not in actions:
            actions.append(action)
    for action in SEVERITY_BASE_ACTIONS.get(severity, []):
        if action not in actions:
            actions.append(action)
    if not actions:
        actions.append("No Action Required")
    return actions
