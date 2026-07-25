from abc import ABC, abstractmethod

from .actions import recommend_actions
from .explain import build_explanation
from .models import RiskAssessment, RiskInput, SignalMatch
from .rules import RULES
from .scoring import severity_bucket


class RiskEngine(ABC):
    """Contract any risk-scoring implementation (rule-based, ML, LLM) must satisfy.

    The API only ever depends on this interface — swapping RuleBasedRiskEngine
    for a trained model or an LLM-backed engine requires no change to main.py,
    only a new implementation of assess() and a change to get_risk_engine().
    """

    @abstractmethod
    def assess(self, data: RiskInput) -> RiskAssessment: ...


class RuleBasedRiskEngine(RiskEngine):
    """Deterministic, explainable engine: sum of weighted rule matches."""

    def assess(self, data: RiskInput) -> RiskAssessment:
        matches: list[SignalMatch] = [m for rule in RULES if (m := rule(data)) is not None]

        raw_score = sum(m.weight for m in matches)
        risk_score = max(0, min(100, raw_score))
        severity = severity_bucket(risk_score)

        positive_signals = [m for m in matches if m.weight > 0]

        # Confidence blends how many corroborating signals fired (correlation
        # strength) with how complete the submitted telemetry was.
        signal_strength = min(len(positive_signals), 5) / 5
        completeness = len(data.model_fields_set) / len(type(data).model_fields)
        confidence = round(min(99.0, max(35.0, 50 + 30 * signal_strength + 19 * completeness)), 1)

        return RiskAssessment(
            risk_score=risk_score,
            confidence=confidence,
            severity=severity,
            signals=[m.name for m in positive_signals],
            signal_details=matches,
            reason=build_explanation(severity, positive_signals),
            recommended_actions=recommend_actions(severity, positive_signals),
        )


_engine: RiskEngine = RuleBasedRiskEngine()


def get_risk_engine() -> RiskEngine:
    """FastAPI dependency. Point this at a different RiskEngine implementation
    (ML model, LLM call, ensemble) to upgrade scoring without touching the API."""
    return _engine
