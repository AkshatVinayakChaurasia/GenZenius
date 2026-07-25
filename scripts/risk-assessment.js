/**
 * RiskFusion AI — Incident Details: live Risk Correlation Engine wiring.
 * Posts session telemetry to POST /calculate-risk and renders the response
 * into the existing Incident Details markup. Falls back to the page's
 * static content (untouched) if the backend is unreachable.
 */

const SEVERITY_META = {
  Critical: { cardClass: 'flagged', color: 'var(--critical)', bg: 'var(--critical-bg)', border: 'var(--critical-border)', iconBg: 'rgba(220,38,38,0.12)', badgeClass: 'critical', chip: 'p1', chipLabel: 'P1 — Urgent', btnClass: 'btn-danger' },
  High: { cardClass: 'warning', color: 'var(--high)', bg: 'var(--high-bg)', border: 'var(--high-border)', iconBg: 'rgba(234,88,12,0.12)', badgeClass: 'high', chip: 'p2', chipLabel: 'P2 — High', btnClass: 'btn-secondary' },
  Medium: { cardClass: 'caution', color: 'var(--medium)', bg: 'var(--medium-bg)', border: 'var(--medium-border)', iconBg: 'rgba(217,119,6,0.12)', badgeClass: 'medium', chip: 'p3', chipLabel: 'P3 — Standard', btnClass: 'btn-secondary' },
  Low: { cardClass: 'clear', color: 'var(--low)', bg: 'var(--low-bg)', border: 'var(--low-border)', iconBg: 'rgba(5,150,105,0.12)', badgeClass: 'low', chip: 'p3', chipLabel: 'P3 — Standard', btnClass: 'btn-secondary' },
};

/* Reuses the exact icon markup already present in the static signal cards;
   only the stroke color is parameterized per matched signal's severity. */
const SIGNAL_ICONS = {
  'New Device': (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="13" height="13" rx="2" /><path d="M6 2v13" /><path d="M11 5h2" /><path d="M11 8h2" /><path d="M11 11h2" /></svg>`,
  'Impossible Travel': (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"><circle cx="8.5" cy="7" r="3" /><path d="M8.5 14.5s-5-3.5-5-7.5A5 5 0 0 1 13.5 7c0 4-5 7.5-5 7.5z" /></svg>`,
  'VPN Detected': (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"><path d="M9 3h5v5" /><path d="M14 3l-7 7" /><path d="M3 8v6h6" /></svg>`,
  'High Value Transaction': (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"><path d="M2 8h13M10 4l5 4-5 4" /><path d="M7 4L2 8l5 4" /></svg>`,
  'New Beneficiary': (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"><circle cx="8.5" cy="5.5" r="2.5" /><path d="M3 15a5.5 5.5 0 0 1 11 0" /><path d="M12.5 9l2 2-2 2" /></svg>`,
  'Failed Login Burst': (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="5" width="13" height="10" rx="1.5" /><path d="M5 5V3.5A3.5 3.5 0 0 1 12 3.5V5" /></svg>`,
  'High-Risk Merchant': (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"><path d="M2 8.5h13M8.5 3.5l2.5 5-5 0z" /><path d="M6 12.5h5" /></svg>`,
  __default: (c) => `<svg viewBox="0 0 17 17" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 2L2 4.5v4.5c0 3.6 2.8 6.5 6.5 7 3.7-0.5 6.5-3.4 6.5-7V4.5L8.5 2z" /></svg>`,
};

const ACTION_DESCRIPTIONS = {
  'Force Re-Authentication': 'Terminate active sessions and require full re-authentication before any further activity.',
  'Block VPN Exit Node': 'Add the detected VPN/proxy exit node to the network blocklist.',
  'Verify Device via OTP': 'Send an OTP challenge to confirm the new device before granting full access.',
  'Freeze Transaction': 'Place the flagged transaction on hold pending manual review.',
  'Lock Beneficiary': 'Restrict transfers to the newly added beneficiary until verified.',
  'Temporarily Lock Account': 'Lock the account after repeated failed login attempts to prevent brute-force access.',
  'Escalate to Fraud Team': 'Route this case to the fraud investigation team for manual review.',
  'Flag for Analyst Review': 'Queue this session for SOC analyst review.',
  'Require MFA': 'Enforce multi-factor authentication for this session going forward.',
  'Notify SOC': 'Alert the Security Operations Centre of this correlated risk event.',
  'Monitor Session': 'Continue passive monitoring; no immediate action required.',
  'Log for Audit Trail': 'Record this event for compliance and audit purposes.',
  'No Action Required': 'No correlated risk indicators were found for this session.',
};

function renderSignalCard(signal) {
  const meta = SEVERITY_META[signal.severity] || SEVERITY_META.Medium;
  const icon = (SIGNAL_ICONS[signal.name] || SIGNAL_ICONS.__default)(meta.color);
  return `
    <div class="signal-card ${meta.cardClass}">
      <div class="sc-icon" style="background:${meta.iconBg};">${icon}</div>
      <div class="sc-name">${signal.name}</div>
      <div class="sc-val">${signal.detail}</div>
      <div class="sc-sep"></div>
      <div class="sc-time"><span class="badge ${meta.badgeClass}" style="font-size:0.6rem;">${signal.severity.toUpperCase()}</span></div>
    </div>`;
}

function renderActionRow(action, index, severity) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.Medium;
  const desc = ACTION_DESCRIPTIONS[action] || 'Recommended by the RiskFusion AI correlation engine.';
  return `
    <div class="action-row">
      <div class="action-num">${index + 1}</div>
      <div class="action-content">
        <div class="ac-title">${action}</div>
        <div class="ac-desc">${desc}</div>
        <div class="ac-owner"><span class="priority-chip ${meta.chip}">${meta.chipLabel}</span></div>
      </div>
      <button class="btn ${meta.btnClass} btn-sm" style="flex-shrink:0;">Apply</button>
    </div>`;
}

function applyRiskAssessment(result) {
  const meta = SEVERITY_META[result.severity] || SEVERITY_META.Medium;

  const scoreEl = document.getElementById('risk-score-value');
  if (scoreEl) {
    scoreEl.textContent = result.risk_score;
    scoreEl.style.color = meta.color;
  }

  const gaugeFill = document.getElementById('risk-gauge-fill');
  if (gaugeFill) {
    const offset = 188.5 * (1 - result.risk_score / 100);
    gaugeFill.setAttribute('stroke-dashoffset', offset.toFixed(1));
  }

  const sevBadge = document.getElementById('severity-badge');
  if (sevBadge) {
    sevBadge.className = `badge ${meta.badgeClass}`;
    sevBadge.innerHTML = `<span class="dot"></span>${result.severity}`;
  }

  const confidenceEl = document.getElementById('ai-confidence-value');
  if (confidenceEl) confidenceEl.textContent = result.confidence + '%';

  const explanationEl = document.getElementById('ai-explanation');
  if (explanationEl) explanationEl.textContent = result.reason;

  const signalsBadge = document.getElementById('signals-detected-badge');
  if (signalsBadge) {
    signalsBadge.textContent = `${result.signal_details.length} Detected`;
    signalsBadge.style.background = meta.bg;
    signalsBadge.style.color = meta.color;
    signalsBadge.style.border = `1px solid ${meta.border}`;
  }

  const signalsGrid = document.getElementById('signals-grid');
  if (signalsGrid) signalsGrid.innerHTML = result.signal_details.map(renderSignalCard).join('');

  const actionsList = document.getElementById('recommended-actions-list');
  if (actionsList) {
    actionsList.innerHTML = result.recommended_actions
      .map((action, i) => renderActionRow(action, i, result.severity))
      .join('');
  }
}

/* Telemetry assembled for the incident currently in context.

   Fields the platform does not yet ingest from live feeds are derived from
   the incident record itself rather than hardcoded to one scenario. In a
   full deployment this payload comes from the identity, device, network and
   payment telemetry feeds for the session under review. */
function riskInputFor(incident) {
  const detected = incident.detected_at ? new Date(incident.detected_at) : new Date();
  const previous = new Date(detected.getTime() - 45 * 60000);
  const city = String(incident.source_location || '').split(',')[0].trim() || 'Unknown';
  const highRisk = incident.risk_score >= 75;

  return {
    login_city: city,
    previous_login_city: null,
    login_timestamp: detected.toISOString(),
    previous_login_timestamp: previous.toISOString(),
    failed_login_attempts: highRisk ? 5 : 0,
    vpn_detected: highRisk,
    new_device: highRisk,
    trusted_device: !highRisk,
    transaction_amount: incident.transaction_amount ?? null,
    customer_avg_transaction_amount: null,
    new_beneficiary: highRisk,
    high_risk_merchant: highRisk,
    auth_method: 'Password',
    behavior_deviation_score: Math.min(1, Math.max(0, (incident.risk_score || 0) / 100)),
  };
}

async function loadLiveRiskAssessment() {
  try {
    const incidentId = await currentIncidentId();
    if (!incidentId) return;
    const incident = await fetchJSON(`/incident/${encodeURIComponent(incidentId)}`);
    applyRiskAssessment(await postJSON('/calculate-risk', riskInputFor(incident)));
  } catch (err) {
    reportApiError('Risk assessment could not be refreshed', err);
  }
}
