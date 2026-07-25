/**
 * RiskFusion AI — API client.
 *
 * Every request carries the signed-in user's Supabase access token; the API
 * rejects anything else. There is no offline fallback data: when a request
 * fails the page shows the failure rather than presenting stale or invented
 * numbers as if they were live.
 */
const API_BASE = globalThis.RISKFUSION_API_BASE ||
  ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') && location.port === '3000'
    ? 'http://127.0.0.1:8000'
    : location.origin);
const API_TIMEOUT_MS = 12000;

async function authHeaders() {
  const token = await window.RiskFusionAuth.getAccessToken();
  if (!token) {
    // The session is gone; send the user back to sign in rather than
    // hammering the API with requests that can only fail.
    window.RiskFusionAuth.redirectToLogin();
    throw new Error('Your session has expired. Please sign in again.');
  }
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** Turns a non-2xx response into an Error carrying the API's own message. */
async function toError(response, path) {
  if (response.status === 401) {
    window.RiskFusionAuth.redirectToLogin();
    return new Error('Your session has expired. Please sign in again.');
  }
  let detail = '';
  try {
    const payload = await response.json();
    detail = payload && (payload.detail || payload.message || '');
    if (Array.isArray(detail)) detail = detail.map(item => item.msg || item).join('; ');
  } catch {
    /* Response had no JSON body. */
  }
  const messages = {
    403: 'You do not have permission to perform this action.',
    404: 'The requested record could not be found.',
    503: 'The service is temporarily unavailable. Please retry shortly.',
  };
  return new Error(detail || messages[response.status] || `Request to ${path} failed (${response.status}).`);
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(API_BASE + path, {
      method,
      headers: await authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw await toError(response, path);
    return response.status === 204 ? null : await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request timed out. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not reach the RiskFusion AI service.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const fetchJSON = (path) => apiRequest(path);
const postJSON = (path, body) => apiRequest(path, { method: 'POST', body });
const patchJSON = (path, body) => apiRequest(path, { method: 'PATCH', body });

function reportApiError(context, error) {
  const message = `${context}: ${error && error.message ? error.message : 'Unknown error'}`;
  console.warn('[RiskFusion API]', message);
  notify(message);
}

function notify(message, tone = 'default') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  const background = tone === 'success' ? '#047857' : tone === 'error' ? '#B91C1C' : '#0f172a';
  toast.style.cssText = `position:fixed;right:20px;bottom:20px;z-index:10000;background:${background};color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 12px 28px rgba(15,23,42,.25);font:600 14px Inter,sans-serif;max-width:min(380px,calc(100vw - 40px));line-height:1.45;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function downloadCsv(filename, rows) {
  if (!rows.length) return notify('There is no data available to export.');
  const headers = Object.keys(rows[0]);
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [headers.join(','), ...rows.map(row => headers.map(header => cell(row[header])).join(','))].join('\n');
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  notify(`${filename} downloaded.`, 'success');
}

/** The incident currently in context, from ?id= or the most recent record. */
async function currentIncidentId() {
  const requested = new URLSearchParams(location.search).get('id');
  if (requested) return requested;
  const incidents = await fetchJSON('/incidents');
  return incidents.length ? incidents[0].id : null;
}

/**
 * Persists a response action against an incident's audit timeline.
 * Returns the updated incident so callers can reflect the new state.
 */
async function recordIncidentAction(incidentId, action, detail, status) {
  return postJSON(`/incident/${encodeURIComponent(incidentId)}/actions`, {
    action,
    detail: detail || '',
    source: 'analyst',
    status: status || null,
  });
}

/* ─── Global controls shared across pages ─── */

document.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;

  if (action === 'export-csv') {
    event.preventDefault();
    try {
      downloadCsv('riskfusion-incidents.csv', await fetchJSON('/incidents'));
    } catch (error) {
      reportApiError('CSV export failed', error);
    }
    return;
  }

  if (action === 'print') {
    event.preventDefault();
    window.print();
    return;
  }

  if (action === 'new-incident') {
    event.preventDefault();
    openIncidentDialog();
    return;
  }

  // Response controls declare what they do and persist it to the incident.
  if (action === 'record') {
    event.preventDefault();
    const label = control.dataset.label || control.textContent.trim();
    const previousText = control.textContent;
    control.disabled = true;
    control.textContent = 'Recording…';
    try {
      const incidentId = control.dataset.incidentId || await currentIncidentId();
      if (!incidentId) throw new Error('There is no incident in context to record against.');
      await recordIncidentAction(incidentId, label, control.dataset.detail || '', control.dataset.status);
      control.textContent = control.dataset.doneLabel || 'Recorded';
      notify(`“${label}” recorded on ${incidentId}.`, 'success');
    } catch (error) {
      control.disabled = false;
      control.textContent = previousText;
      reportApiError(`Could not record “${label}”`, error);
    }
  }
});

/* ─── New incident dialog ─── */

/** Replaces the previous chain of prompt() dialogs with a real form. */
function openIncidentDialog() {
  if (document.getElementById('incident-dialog')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'incident-dialog';
  dialog.style.cssText = 'border:none;border-radius:14px;padding:0;max-width:460px;width:calc(100% - 32px);box-shadow:0 24px 60px rgba(15,23,42,.28);';
  dialog.innerHTML = `
    <form method="dialog" id="incident-form" style="padding:24px;font-family:Inter,sans-serif;">
      <h2 style="margin:0 0 4px;font-size:1.0625rem;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">Raise a new incident</h2>
      <p style="margin:0 0 20px;font-size:0.8125rem;color:#64748B;line-height:1.5;">This creates a live record in the incident queue.</p>

      <label style="display:block;font-size:0.75rem;font-weight:700;color:#334155;margin-bottom:6px;">Title</label>
      <input name="title" required minlength="3" maxlength="160" placeholder="Short description of what was observed"
        style="width:100%;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font:inherit;font-size:0.875rem;margin-bottom:16px;box-sizing:border-box;" />

      <label style="display:block;font-size:0.75rem;font-weight:700;color:#334155;margin-bottom:6px;">Incident type</label>
      <select name="incident_type" style="width:100%;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font:inherit;font-size:0.875rem;margin-bottom:16px;box-sizing:border-box;background:#fff;">
        <option>Account Takeover</option>
        <option>Fraudulent Transaction</option>
        <option>Authentication Abuse</option>
        <option>Privilege Escalation</option>
        <option>Card Fraud</option>
        <option>Insider Threat</option>
        <option>Phishing</option>
        <option selected>Security Alert</option>
      </select>

      <label style="display:block;font-size:0.75rem;font-weight:700;color:#334155;margin-bottom:6px;">Severity</label>
      <select name="severity" style="width:100%;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font:inherit;font-size:0.875rem;margin-bottom:16px;box-sizing:border-box;background:#fff;">
        <option>Critical</option><option>High</option><option selected>Medium</option><option>Low</option>
      </select>

      <label style="display:block;font-size:0.75rem;font-weight:700;color:#334155;margin-bottom:6px;">What was observed</label>
      <textarea name="description" rows="3" maxlength="1000" placeholder="Context an analyst picking this up would need"
        style="width:100%;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font:inherit;font-size:0.875rem;margin-bottom:20px;box-sizing:border-box;resize:vertical;"></textarea>

      <p id="incident-form-error" style="display:none;margin:0 0 14px;font-size:0.8125rem;color:#B91C1C;"></p>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" id="incident-cancel" style="padding:9px 16px;border:1.5px solid #E2E8F0;background:#fff;border-radius:8px;font:600 0.875rem Inter,sans-serif;color:#334155;cursor:pointer;">Cancel</button>
        <button type="submit" id="incident-submit" style="padding:9px 16px;border:none;background:#2563EB;color:#fff;border-radius:8px;font:600 0.875rem Inter,sans-serif;cursor:pointer;">Create incident</button>
      </div>
    </form>`;

  document.body.appendChild(dialog);
  dialog.showModal();

  const close = () => { dialog.close(); dialog.remove(); };
  document.getElementById('incident-cancel').addEventListener('click', close);
  dialog.addEventListener('cancel', close);

  document.getElementById('incident-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.getElementById('incident-form-error');
    const submit = document.getElementById('incident-submit');
    error.style.display = 'none';

    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.title || data.title.trim().length < 3) {
      error.textContent = 'Give the incident a title of at least 3 characters.';
      error.style.display = 'block';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Creating…';
    try {
      const created = await postJSON('/incidents', {
        title: data.title.trim(),
        incident_type: data.incident_type,
        severity: data.severity,
        description: data.description.trim() || 'Raised from the RiskFusion AI workspace.',
      });
      close();
      notify(`${created.id} created.`, 'success');
      location.href = `incident.html?id=${encodeURIComponent(created.id)}`;
    } catch (apiError) {
      submit.disabled = false;
      submit.textContent = 'Create incident';
      error.textContent = apiError.message;
      error.style.display = 'block';
    }
  });
}
