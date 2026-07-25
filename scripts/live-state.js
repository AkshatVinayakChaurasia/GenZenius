/* Page-safe live data bindings. Never replace a page's own workspace. */
(async function () {
  if (typeof fetchJSON !== 'function') return;

  const page = location.pathname.split('/').pop() || 'index.html';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const inr = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
  const severityClass = (value) => ['critical', 'high', 'medium', 'low'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'info';

  try {
    if (page === 'analytics.html') {
      const data = await fetchJSON('/analytics');
      const kpis = document.querySelectorAll('.kpi-value');
      if (kpis[0]) kpis[0].textContent = data.transaction_risk.flagged_transaction_count.toLocaleString('en-IN');
      if (kpis[1]) kpis[1].textContent = data.total_incidents.toLocaleString('en-IN');
      if (kpis[2]) kpis[2].textContent = (data.incidents_by_severity.find(item => item.severity === 'High')?.count || 0).toLocaleString('en-IN');
      if (kpis[3]) kpis[3].textContent = inr(data.transaction_risk.flagged_transaction_value);
      if (kpis[4]) kpis[4].innerHTML = `${data.model_performance.average_ai_confidence}<span style="font-size:1rem;">%</span>`;

      const geoChart = typeof Chart !== 'undefined' && Chart.getChart('geoChart');
      if (geoChart) {
        geoChart.data.labels = data.top_risk_locations.map(item => item.location || 'Unknown');
        geoChart.data.datasets[0].data = data.top_risk_locations.map(item => item.incidents);
        geoChart.update();
      }
      const geoRows = document.querySelector('.geo-row')?.parentElement;
      if (geoRows) geoRows.innerHTML = data.top_risk_locations.length ? data.top_risk_locations.map(item => `<div class="geo-row"><div class="geo-country">${escapeHtml(item.location || 'Unknown')}</div><div><span class="badge ${severityClass(item.incidents >= 3 ? 'High' : 'Medium')}">${item.incidents >= 3 ? 'High' : 'Elevated'} risk</span></div><div class="geo-count">${item.incidents} incident${item.incidents === 1 ? '' : 's'}</div></div>`).join('') : '<div class="empty-state">No location data is available yet.</div>';
    }

    if (['investigation.html', 'killchain.html', 'ai.html', 'incident.html'].includes(page)) {
      const requestedId = new URLSearchParams(location.search).get('id');
      const incidents = await fetchJSON('/incidents');
      const selected = requestedId ? incidents.find(item => item.id === requestedId) : incidents[0];
      if (!selected) return;

      if (page === 'investigation.html' || page === 'killchain.html') {
        const sub = document.querySelector('.pg-sub');
        if (sub) sub.innerHTML = `${escapeHtml(selected.id)} · ${escapeHtml(selected.title)} · <span id="live-time">--:--:--</span>`;
      }
      document.querySelectorAll('a[href="incident.html"]').forEach(link => link.href = `incident.html?id=${encodeURIComponent(selected.id)}`);
      document.querySelectorAll('a[href="ai.html"]').forEach(link => link.href = `ai.html?id=${encodeURIComponent(selected.id)}`);
      document.querySelectorAll('a[href="killchain.html"]').forEach(link => link.href = `killchain.html?id=${encodeURIComponent(selected.id)}`);

      if (page === 'ai.html') {
        const context = document.querySelectorAll('.meta-row .meta-value');
        if (context[0]) context[0].textContent = selected.id;
        if (context[1]) context[1].textContent = selected.customer_name || 'Unassigned';
        if (context[3]) context[3].innerHTML = `<span class="badge ${severityClass(selected.status)}">${escapeHtml(selected.status)}</span>`;
        if (context[4]) context[4].innerHTML = `<span class="badge ${severityClass(selected.severity)}">${escapeHtml(selected.severity)}</span>`;
        if (context[5]) context[5].textContent = `${selected.risk_score} / 100`;
        const display = document.getElementById('conf-display');
        const bar = document.getElementById('conf-bar');
        if (display) display.textContent = `${selected.ai_confidence}%`;
        if (bar) bar.style.width = `${Math.max(0, Math.min(100, selected.ai_confidence))}%`;
      }

      if (page === 'incident.html') {
        const detail = await fetchJSON(`/incident/${encodeURIComponent(selected.id)}`);
        const title = document.getElementById('incident-title');
        if (title) title.textContent = detail.title;
        const breadcrumb = document.getElementById('incident-id-breadcrumb');
        if (breadcrumb) breadcrumb.textContent = detail.id;
        const desc = document.getElementById('ai-explanation');
        if (desc) desc.textContent = detail.description;
        const score = document.getElementById('risk-score-value');
        if (score) score.textContent = detail.risk_score;
        const confidence = document.getElementById('ai-confidence-value');
        if (confidence) confidence.textContent = `${detail.ai_confidence}%`;
        const badge = document.getElementById('severity-badge');
        if (badge) {
          badge.className = `badge ${severityClass(detail.severity)}`;
          badge.innerHTML = `<span class="dot"></span>${escapeHtml(detail.severity)}`;
        }
        const status = document.getElementById('incident-status-badge');
        if (status) {
          status.className = `badge ${severityClass(detail.status)}`;
          status.textContent = detail.status;
        }
        const resolveButton = document.getElementById('resolve-incident-btn');
        if (resolveButton) {
          resolveButton.dataset.incidentId = detail.id;
          resolveButton.disabled = detail.status === 'Resolved';
          resolveButton.textContent = detail.status === 'Resolved' ? 'Incident Resolved' : 'Resolve Incident';
          resolveButton.addEventListener('click', async () => {
            if (!confirm(`Resolve ${detail.id}? This keeps the incident history.`)) return;
            try {
              await patchJSON(`/incident/${encodeURIComponent(detail.id)}`, { status: 'Resolved' });
              notify(`${detail.id} marked as resolved.`);
              location.href = 'incidents.html';
            } catch (error) {
              reportApiError(`Could not resolve ${detail.id}`, error);
            }
          }, { once: true });
        }
      }
    }
  } catch (error) {
    reportApiError('Live data could not be refreshed', error);
  }
})();
