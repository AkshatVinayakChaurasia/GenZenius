from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .models import Incident


def _dt(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 7, day, hour, minute)


def _signal(name: str, contribution: int, detail: str, at: datetime) -> dict:
    return {"name": name, "risk_contribution": contribution, "detail": detail, "observed_at": at.isoformat()}


def _event(at: datetime, event: str, source: str, detail: str) -> dict:
    return {"timestamp": at.isoformat(), "event": event, "source": source, "detail": detail}


def seed_database(db: Session) -> None:
    if db.query(Incident).first():
        return

    base = _dt(24, 10, 12)
    records = [
        {
            "id": "INC-2026-0847", "title": "Probable Account Takeover", "incident_type": "Account Takeover",
            "severity": "Critical", "status": "Investigating", "risk_score": 94, "ai_confidence": 96.4,
            "customer_name": "Arjun Kapoor", "customer_id": "CUS-84721", "bank": "HDFC Bank", "source_location": "Moscow, Russia",
            "detected_at": base, "updated_at": base + timedelta(minutes=8), "transaction_amount": 1472000.0,
            "description": "A login from Moscow followed a successful Mumbai session by 31 minutes. A new device, commercial VPN, new beneficiary, and a high-value wire transfer were correlated into a likely account takeover.",
            "signals": [
                _signal("Impossible Travel", 31, "Mumbai to Moscow (6,230 km) in 31 minutes.", base - timedelta(minutes=1)),
                _signal("VPN Detected", 17, "Login originated from a known commercial VPN exit node.", base),
                _signal("New Device", 14, "Unrecognized Windows device with a new browser fingerprint.", base + timedelta(minutes=1)),
                _signal("New Beneficiary", 18, "Beneficiary added 94 seconds before transfer initiation.", base + timedelta(minutes=3)),
                _signal("High Value Transaction", 14, "₹14.72L transfer is 18x the customer's usual value.", base + timedelta(minutes=4)),
            ],
            "timeline": [
                _event(base - timedelta(minutes=31), "Successful login", "Identity", "Known iPhone session from Mumbai."),
                _event(base, "Suspicious login", "Identity", "New device sign-in from Moscow via VPN."),
                _event(base + timedelta(minutes=3), "Beneficiary added", "Payments", "New beneficiary: Eastern Trade LLC."),
                _event(base + timedelta(minutes=4), "Wire transfer initiated", "Payments", "₹14,72,000 transfer pending risk review."),
            ],
            "recommended_actions": ["Place a hold on the wire transfer.", "Force credential reset and revoke active sessions.", "Call customer using verified contact details.", "Review beneficiary and VPN IP against fraud watchlists."],
            "mitre_techniques": ["T1078 - Valid Accounts", "T1090 - Proxy", "T1098 - Account Manipulation"],
        },
        {
            "id": "INC-2026-0846", "title": "Unusual High-Value NEFT Transfer", "incident_type": "Transaction Fraud",
            "severity": "High", "status": "Open", "risk_score": 82, "ai_confidence": 92.1,
            "customer_name": "Meera Iyer", "customer_id": "CUS-39018", "bank": "ICICI Bank", "source_location": "Bengaluru, India",
            "detected_at": _dt(24, 9, 46), "updated_at": _dt(24, 10, 2), "transaction_amount": 850000.0,
            "description": "A high-value NEFT transfer was initiated from a recently enrolled Android device, outside the customer's established payment window.",
            "signals": [_signal("High Value Transaction", 36, "₹8.50L is 12x the 90-day transaction average.", _dt(24, 9, 46)), _signal("New Device", 21, "Device enrolled today with no prior trusted activity.", _dt(24, 9, 41)), _signal("Behavioral Anomaly", 15, "Payment initiated at an unusual hour for this customer.", _dt(24, 9, 46))],
            "timeline": [_event(_dt(24, 9, 41), "Device enrolled", "Device Intelligence", "New Android 15 device added."), _event(_dt(24, 9, 46), "NEFT initiated", "Payments", "₹8,50,000 to a corporate account.")],
            "recommended_actions": ["Step up authentication before release.", "Validate transaction intent with customer.", "Temporarily restrict new-device transfers."],
            "mitre_techniques": ["T1078 - Valid Accounts", "T1021 - Remote Services"],
        },
        {
            "id": "INC-2026-0845", "title": "Brute Force Login Pattern", "incident_type": "Credential Attack",
            "severity": "High", "status": "Contained", "risk_score": 77, "ai_confidence": 89.7,
            "customer_name": "Rohan Malhotra", "customer_id": "CUS-21904", "bank": "Axis Bank", "source_location": "Delhi, India",
            "detected_at": _dt(24, 8, 28), "updated_at": _dt(24, 9, 5), "transaction_amount": None,
            "description": "A burst of failed sign-in attempts from three IP addresses preceded a successful login. No payment activity was observed.",
            "signals": [_signal("Multiple Failed Login Attempts", 38, "19 failed attempts across three IPs in 12 minutes.", _dt(24, 8, 26)), _signal("New Device", 17, "Successful login used an unseen browser fingerprint.", _dt(24, 8, 28)), _signal("Tor Exit Node", 14, "One failed-login source mapped to a Tor exit node.", _dt(24, 8, 22))],
            "timeline": [_event(_dt(24, 8, 16), "Failed login burst", "Identity", "Repeated password failures detected."), _event(_dt(24, 8, 28), "Successful login", "Identity", "Login allowed after correct password."), _event(_dt(24, 9, 5), "Sessions revoked", "SOAR", "Automatic containment completed.")],
            "recommended_actions": ["Maintain forced password reset.", "Monitor account for 72 hours.", "Block malicious source IPs."],
            "mitre_techniques": ["T1110 - Brute Force", "T1078 - Valid Accounts"],
        },
        {
            "id": "INC-2026-0844", "title": "New Beneficiary and Cardless Cash Attempt", "incident_type": "Payment Fraud",
            "severity": "Medium", "status": "Open", "risk_score": 68, "ai_confidence": 86.2,
            "customer_name": "Neha Sharma", "customer_id": "CUS-55607", "bank": "SBI", "source_location": "Pune, India",
            "detected_at": _dt(23, 22, 15), "updated_at": _dt(24, 8, 15), "transaction_amount": 49000.0,
            "description": "A new beneficiary was created shortly before a cardless cash withdrawal attempt at the customer's daily limit.",
            "signals": [_signal("New Beneficiary", 27, "Beneficiary has no prior relationship history.", _dt(23, 22, 12)), _signal("Cardless Cash Withdrawal", 25, "₹49,000 withdrawal attempt near daily limit.", _dt(23, 22, 15)), _signal("Velocity Anomaly", 16, "Three transaction channels used in 9 minutes.", _dt(23, 22, 15))],
            "timeline": [_event(_dt(23, 22, 6), "Mobile login", "Identity", "Recognized device from Pune."), _event(_dt(23, 22, 12), "Beneficiary added", "Payments", "New beneficiary created."), _event(_dt(23, 22, 15), "Cash withdrawal requested", "ATM Network", "Cardless cash token issued.")],
            "recommended_actions": ["Cancel active cash token.", "Verify beneficiary addition.", "Apply a temporary transaction limit."],
            "mitre_techniques": ["T1098 - Account Manipulation"],
        },
        {
            "id": "INC-2026-0843", "title": "Impossible Travel Login", "incident_type": "Identity Anomaly",
            "severity": "Medium", "status": "Resolved", "risk_score": 59, "ai_confidence": 81.5,
            "customer_name": "Vikram Singh", "customer_id": "CUS-88103", "bank": "Kotak Mahindra Bank", "source_location": "Dubai, UAE",
            "detected_at": _dt(23, 17, 22), "updated_at": _dt(23, 19, 7), "transaction_amount": None,
            "description": "A session moved from Chennai to Dubai in 44 minutes. Customer confirmed legitimate travel and the case was resolved.",
            "signals": [_signal("Impossible Travel", 34, "Chennai to Dubai in 44 minutes.", _dt(23, 17, 22)), _signal("New Network", 12, "First observed UAE mobile carrier connection.", _dt(23, 17, 22))],
            "timeline": [_event(_dt(23, 16, 38), "Successful login", "Identity", "Known laptop session from Chennai."), _event(_dt(23, 17, 22), "Successful login", "Identity", "Mobile login from Dubai."), _event(_dt(23, 19, 7), "Customer confirmed travel", "Case Management", "Alert closed as legitimate.")],
            "recommended_actions": ["No further action required."], "mitre_techniques": [],
        },
        {
            "id": "INC-2026-0842", "title": "Commercial VPN Access", "incident_type": "Network Anomaly",
            "severity": "Low", "status": "Monitoring", "risk_score": 41, "ai_confidence": 74.9,
            "customer_name": "Aditi Rao", "customer_id": "CUS-10478", "bank": "Yes Bank", "source_location": "Frankfurt, Germany",
            "detected_at": _dt(22, 14, 10), "updated_at": _dt(23, 14, 10), "transaction_amount": None,
            "description": "Customer portal access originated from a commercial VPN node. Device and behavior otherwise matched historical activity.",
            "signals": [_signal("VPN Detected", 19, "Commercial VPN exit node detected.", _dt(22, 14, 10)), _signal("Foreign Network", 11, "First access from Germany in 180 days.", _dt(22, 14, 10))],
            "timeline": [_event(_dt(22, 14, 10), "Portal login", "Identity", "Successful authenticated session from Frankfurt.")],
            "recommended_actions": ["Monitor for transaction activity.", "Prompt for travel verification on next login."], "mitre_techniques": ["T1090 - Proxy"],
        },
    ]
    db.add_all([Incident(**record) for record in records])
    db.commit()
