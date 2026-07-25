/**
 * RiskFusion AI — Backend API Helper
 * Fetches live data from the FastAPI backend when it's reachable.
 * Callers must fall back to their existing hardcoded data on failure.
 */
const API_BASE = globalThis.RISKFUSION_API_BASE ||
  ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') && location.port === '3000'
    ? 'http://127.0.0.1:8000'
    : location.origin);
const API_TIMEOUT_MS = 2500;

async function fetchJSON(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, { signal: controller.signal });
    if (!res.ok) throw new Error('API ' + path + ' returned ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function reportApiError(context, error) {
  const message = `${context}: ${error && error.message ? error.message : 'Unknown error'}`;
  // Keep failures visible to the analyst without producing an uncaught console error.
  console.warn('[RiskFusion API]', message);
  notify(message);
}

async function postJSON(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('API ' + path + ' returned ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function patchJSON(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
    });
    if (!res.ok) throw new Error('API ' + path + ' returned ' + res.status);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function notify(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:10000;background:#0f172a;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 12px 28px rgba(15,23,42,.25);font:600 14px Inter,sans-serif;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

async function createIncidentFromPrompt() {
  const title = prompt('Incident title');
  if (!title) return;
  const incident_type = prompt('Incident type', 'Security Alert') || 'Security Alert';
  const severity = prompt('Severity: Critical, High, Medium, or Low', 'Medium') || 'Medium';
  try {
    await postJSON('/incidents', { title, incident_type, severity });
    notify('Incident created and saved live.');
    setTimeout(() => location.href = 'incidents.html', 350);
  } catch (error) {
    notify('Could not create incident: ' + error.message);
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button, a');
  if (!button) return;
  const label = button.textContent.replace(/\s+/g, ' ').trim();
  if (label === 'New Incident') {
    event.preventDefault();
    createIncidentFromPrompt();
  } else if (label === 'Export' || label === 'Export PDF' || label === 'Download') {
    event.preventDefault();
    window.print();
  }
});
