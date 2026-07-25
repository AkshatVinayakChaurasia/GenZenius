/**
 * RiskFusion AI — Shared App Scripts
 * Enterprise Banking Incident Correlation Platform
 */

/* ─── Sidebar Active State ─── */
(function () {
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === current || (current === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
})();

/* ─── Topbar Search Keyboard Shortcut ─── */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const input = document.querySelector('.topbar-search input');
    if (input) input.focus();
  }
});

/* ─── Workspace navigation and analyst utilities ─── */
function appToast(message, tone = 'default') {
  if (typeof notify === 'function') return notify(message);
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.style.cssText = `position:fixed;right:20px;bottom:20px;z-index:10000;background:${tone === 'success' ? '#047857' : '#0f172a'};color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 12px 28px rgba(15,23,42,.25);font:600 14px Inter,sans-serif;max-width:min(360px,calc(100vw - 40px));`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  const search = document.querySelector('.topbar-search input');
  if (search) search.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !search.value.trim()) return;
    location.href = `incidents.html?q=${encodeURIComponent(search.value.trim())}`;
  });
  document.getElementById('settings-button')?.addEventListener('click', () => { location.href = 'config.html'; });

  // Notifications summarise the real open critical workload.
  document.getElementById('notifications-button')?.addEventListener('click', async () => {
    if (typeof fetchJSON !== 'function') return;
    try {
      const incidents = await fetchJSON('/incidents');
      const open = incidents.filter(item => !['Resolved', 'Closed'].includes(item.status));
      const critical = open.filter(item => item.severity === 'Critical');
      appToast(critical.length
        ? `${critical.length} critical incident${critical.length === 1 ? '' : 's'} open of ${open.length} active.`
        : open.length ? `No critical incidents. ${open.length} active incident${open.length === 1 ? '' : 's'} in progress.`
          : 'No active incidents. The workspace is clear.');
    } catch (error) {
      appToast('Notifications are unavailable: ' + error.message);
    }
  });

  document.getElementById('profile-button')?.addEventListener('click', signOutOfWorkspace);
  document.getElementById('service-status-chip') && refreshServiceStatus();
});

/** Ends the Supabase session (revoking it server-side) and returns to sign-in. */
async function signOutOfWorkspace() {
  if (!confirm('Sign out of RiskFusion AI?')) return;
  try {
    await window.RiskFusionAuth.signOut();
  } finally {
    location.replace('index.html');
  }
}

/** Reflects real API reachability in the topbar rather than asserting health. */
async function refreshServiceStatus() {
  const chip = document.getElementById('service-status-chip');
  const text = document.getElementById('service-status-text');
  if (!chip || !text || typeof fetchJSON !== 'function') return;
  try {
    await fetchJSON('/health');
    text.textContent = 'All systems operational';
    chip.classList.remove('degraded');
  } catch {
    text.textContent = 'Service degraded';
    chip.classList.add('degraded');
  }
}

/* ─── Time Update ─── */
function updateTime() {
  const el = document.getElementById('live-time');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
setInterval(updateTime, 1000);
updateTime();

/* ─── Ripple Effect on Buttons ─── */
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.style.cssText = `
    position:absolute;
    border-radius:50%;
    pointer-events:none;
    width:100px; height:100px;
    top:${e.clientY - rect.top - 50}px;
    left:${e.clientX - rect.left - 50}px;
    background:rgba(255,255,255,0.2);
    transform:scale(0);
    animation:btnRipple 0.5s ease forwards;
  `;
  if (!btn.style.position || btn.style.position === 'static') btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
});

const rippleStyle = document.createElement('style');
rippleStyle.textContent = `@keyframes btnRipple{to{transform:scale(4);opacity:0}}`;
document.head.appendChild(rippleStyle);

/* ─── Tooltip ─── */
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip]');
  if (!el) return;
  const tip = el.getAttribute('data-tip');
  if (!tip) return;

  const tooltip = document.createElement('div');
  tooltip.className = '__tooltip';
  tooltip.textContent = tip;
  tooltip.style.cssText = `
    position:fixed; z-index:9999;
    background:#0F172A; color:#fff;
    font-size:12px; font-weight:500;
    padding:5px 10px; border-radius:6px;
    pointer-events:none; white-space:nowrap;
    font-family:'Inter',sans-serif;
    box-shadow:0 4px 12px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(tooltip);

  const pos = el.getBoundingClientRect();
  tooltip.style.top  = (pos.top - tooltip.offsetHeight - 6) + 'px';
  tooltip.style.left = (pos.left + pos.width / 2 - tooltip.offsetWidth / 2) + 'px';

  el.addEventListener('mouseleave', () => tooltip.remove(), { once: true });
});

/* ─── Chart.js Global Defaults ─── */
function applyChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size   = 12;
  Chart.defaults.color       = '#64748B';
  Chart.defaults.plugins.legend.labels.boxWidth    = 10;
  Chart.defaults.plugins.legend.labels.padding     = 16;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor  = '#0F172A';
  Chart.defaults.plugins.tooltip.padding          = 10;
  Chart.defaults.plugins.tooltip.cornerRadius     = 8;
  Chart.defaults.plugins.tooltip.titleFont        = { weight: '700', size: 12 };
  Chart.defaults.plugins.tooltip.bodyFont         = { size: 12 };
  Chart.defaults.plugins.tooltip.callbacks        = {};
  Chart.defaults.scale.grid.color                 = '#F1F5F9';
  Chart.defaults.scale.grid.borderColor           = '#E2E8F0';
  Chart.defaults.scale.ticks.padding              = 6;
}

document.addEventListener('DOMContentLoaded', applyChartDefaults);
