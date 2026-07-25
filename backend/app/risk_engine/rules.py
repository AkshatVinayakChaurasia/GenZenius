from typing import Callable, Optional

from .geo import MAX_PLAUSIBLE_SPEED_KMH, distance_km
from .models import RiskInput, SignalMatch

Rule = Callable[[RiskInput], Optional[SignalMatch]]


def impossible_travel_rule(data: RiskInput) -> Optional[SignalMatch]:
    if not data.previous_login_city or not data.previous_login_timestamp:
        return None
    if data.previous_login_city.strip().lower() == data.login_city.strip().lower():
        return None

    elapsed_hours = (data.login_timestamp - data.previous_login_timestamp).total_seconds() / 3600
    if elapsed_hours <= 0:
        return None

    dist = distance_km(data.previous_login_city, data.login_city)
    if dist is not None:
        speed = dist / elapsed_hours
        if speed <= MAX_PLAUSIBLE_SPEED_KMH:
            return None
        detail = (
            f"{data.previous_login_city} to {data.login_city} ({dist:,.0f} km) in "
            f"{elapsed_hours * 60:.0f} min — implies {speed:,.0f} km/h travel."
        )
    else:
        if elapsed_hours > 1:
            return None
        detail = (
            f"{data.previous_login_city} to {data.login_city} in {elapsed_hours * 60:.0f} min — "
            "different locations in an implausible timeframe."
        )

    return SignalMatch(name="Impossible Travel", weight=25, detail=detail, severity="Critical")


def vpn_rule(data: RiskInput) -> Optional[SignalMatch]:
    if not data.vpn_detected:
        return None
    return SignalMatch(
        name="VPN Detected", weight=20,
        detail="Login originated from a known commercial VPN / proxy exit node.",
        severity="Critical",
    )


def new_device_rule(data: RiskInput) -> Optional[SignalMatch]:
    if not data.new_device or data.trusted_device:
        return None
    return SignalMatch(
        name="New Device", weight=15,
        detail="Unrecognized device fingerprint — never seen before on this account.",
        severity="High",
    )


def large_transaction_rule(data: RiskInput) -> Optional[SignalMatch]:
    if data.transaction_amount is None:
        return None
    baseline = data.customer_avg_transaction_amount
    if baseline and baseline > 0:
        multiple = data.transaction_amount / baseline
        if multiple < 5:
            return None
        detail = f"₹{data.transaction_amount:,.0f} is {multiple:,.1f}x this customer's average transaction (₹{baseline:,.0f})."
    else:
        if data.transaction_amount < 500_000:
            return None
        detail = f"₹{data.transaction_amount:,.0f} transaction exceeds the ₹5,00,000 high-value threshold."
    return SignalMatch(name="High Value Transaction", weight=20, detail=detail, severity="High")


def new_beneficiary_rule(data: RiskInput) -> Optional[SignalMatch]:
    if not data.new_beneficiary:
        return None
    return SignalMatch(
        name="New Beneficiary", weight=15,
        detail="Funds moved to a beneficiary with no prior relationship history.",
        severity="High",
    )


def failed_login_burst_rule(data: RiskInput) -> Optional[SignalMatch]:
    if data.failed_login_attempts < 5:
        return None
    return SignalMatch(
        name="Failed Login Burst", weight=10,
        detail=f"{data.failed_login_attempts} failed login attempts immediately preceding this session.",
        severity="Medium",
    )


def high_risk_merchant_rule(data: RiskInput) -> Optional[SignalMatch]:
    if not data.high_risk_merchant:
        return None
    return SignalMatch(
        name="High-Risk Merchant", weight=10,
        detail="Beneficiary/merchant category matches a known high-risk watchlist (crypto, money transfer, gambling).",
        severity="Medium",
    )


def trusted_device_rule(data: RiskInput) -> Optional[SignalMatch]:
    if not data.trusted_device:
        return None
    return SignalMatch(
        name="Trusted Device", weight=-10,
        detail="Session originated from a verified, previously trusted device.",
        severity="Low",
    )


def weak_auth_rule(data: RiskInput) -> Optional[SignalMatch]:
    if data.auth_method == "Password":
        return SignalMatch(
            name="Weak Authentication Method", weight=5,
            detail="Session was authenticated with password only — no step-up MFA.",
            severity="Medium",
        )
    if data.auth_method in ("MFA", "Biometric"):
        return SignalMatch(
            name="Strong Authentication Verified", weight=-5,
            detail=f"Session verified via {data.auth_method} — reduces takeover likelihood.",
            severity="Low",
        )
    return None


def behavioral_anomaly_rule(data: RiskInput) -> Optional[SignalMatch]:
    if data.behavior_deviation_score is None or data.behavior_deviation_score < 0.7:
        return None
    return SignalMatch(
        name="Behavioral Anomaly", weight=10,
        detail=f"Session deviates {data.behavior_deviation_score * 100:.0f}% from this customer's established behaviour baseline.",
        severity="Medium",
    )


RULES: list[Rule] = [
    impossible_travel_rule,
    vpn_rule,
    new_device_rule,
    large_transaction_rule,
    new_beneficiary_rule,
    failed_login_burst_rule,
    high_risk_merchant_rule,
    trusted_device_rule,
    weak_auth_rule,
    behavioral_anomaly_rule,
]
