from .models import SignalMatch

_SEVERITY_PHRASE = {
    "Critical": "a high probability of account takeover or fraud",
    "High": "a significant likelihood of fraudulent activity",
    "Medium": "an elevated but not yet conclusive risk pattern",
    "Low": "routine activity with only minor deviations",
}


def build_explanation(severity: str, signals: list[SignalMatch]) -> str:
    if not signals:
        return "No correlated risk indicators were detected for this session."

    ranked = sorted(signals, key=lambda s: s.weight, reverse=True)
    top_names = [s.name for s in ranked[:3]]
    names = ", ".join(top_names)
    phrase = _SEVERITY_PHRASE.get(severity, "an uncertain risk pattern")
    plural = "s" if len(signals) != 1 else ""

    return f"{len(signals)} correlated indicator{plural} ({names}) suggest {phrase}."
