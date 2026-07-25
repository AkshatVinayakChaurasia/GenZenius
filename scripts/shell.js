/**
 * RiskFusion AI — Shared Sidebar/Navbar HTML
 * Injected by each page via script
 */
function renderShell(activePage) {
  if (!localStorage.getItem('riskfusion-user')) {
    window.location.replace('index.html');
    return;
  }

  const navItems = [
    {
      group: 'Operations',
      items: [
        { icon: iconGrid, label: 'SOC Dashboard', href: 'dashboard.html', id: 'dashboard', count: null },
        { icon: iconShield, label: 'Incidents', href: 'incidents.html', id: 'incidents', count: '12', countClass: '' },
        { icon: iconSearch, label: 'Investigations', href: 'investigation.html', id: 'investigation', count: '4', countClass: 'info' },
        { icon: iconChart, label: 'Analytics', href: 'analytics.html', id: 'analytics', count: null },
      ]
    },
    {
      group: 'Intelligence',
      items: [
        { icon: iconTimeline, label: 'Attack Kill Chain', href: 'killchain.html', id: 'killchain', count: null },
        { icon: iconIncident, label: 'Incident Details', href: 'incident.html', id: 'incident', count: null },
        { icon: iconAI, label: 'AI Analyst', href: 'ai.html', id: 'ai', count: null },
      ]
    },
    {
      group: 'Settings',
      items: [
        { icon: iconSettings, label: 'Configuration', href: 'config.html', id: 'settings', count: null },
      ]
    }
  ];

  function navHTML() {
    return navItems.map(group => `
      <div class="nav-group">
        <div class="nav-group-label">${group.group}</div>
        ${group.items.map(item => `
          <a href="${item.href}" class="nav-link${activePage === item.id ? ' active' : ''}">
            ${item.icon()}
            <span>${item.label}</span>
            ${item.count ? `<span class="nav-count ${item.countClass || ''}">${item.count}</span>` : ''}
          </a>
        `).join('')}
      </div>
    `).join('');
  }

  document.getElementById('app-sidebar').innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-mark">${iconLogo()}</div>
      <div class="logo-name">
        <div class="name">Risk<span>Fusion</span> AI</div>
        <div class="tagline">Banking Security Platform</div>
      </div>
    </div>
    <nav class="sidebar-nav">${navHTML()}</nav>
    <div class="sidebar-footer">
      <div class="nav-link" style="cursor:default;">
        ${iconUser()}
        <div>
          <div style="font-size:0.8125rem;font-weight:600;color:var(--text-primary);">Admin</div>
          <div style="font-size:0.6875rem;color:var(--text-muted);">SOC Administrator</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('app-topbar').innerHTML = `
    <div class="topbar-search">
      ${iconSearchSm()}
      <input type="text" placeholder="Search incidents, alerts, entities… (⌘K)" />
    </div>
    <div class="topbar-right">
      <div class="topbar-chip"><div class="dot"></div>All Systems Operational</div>
      <div style="width:1px;height:20px;background:var(--border-default);margin:0 4px;"></div>
      <span style="font-size:0.75rem;color:var(--text-muted);font-weight:600;font-family:monospace;" id="live-time">--:--:--</span>
      <button class="icon-btn" type="button" data-tip="Notifications" id="notifications-button" aria-label="Open notifications">
        ${iconBell()}
        <span class="badge-dot"></span>
      </button>
      <button class="icon-btn" type="button" data-tip="Settings" id="settings-button" aria-label="Open configuration">${iconGear()}</button>
      <button class="avatar-btn" type="button" id="profile-button" aria-label="Sign out of the demo">
        <div class="avatar">AD</div>
        <div class="avatar-info">
          <div class="av-name">Demo Analyst</div>
          <div class="av-role">HDFC · SOC L3</div>
        </div>
        ${iconChevron()}
      </button>
    </div>
  `;
}

/* ─── Icon Library (SVG functions) ─── */
const iconLogo = () => `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
const iconGrid = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`;
const iconShield = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5L2 4v4c0 3.3 2.6 6 6 6s6-2.7 6-6V4L8 1.5z"/></svg>`;
const iconSearch = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4"/><path d="M15 15l-3.5-3.5"/></svg>`;
const iconChart = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 12 5 7 8 9 12 4 15 6"/><rect x="1" y="13" width="14" height="1.5" rx="0.75" fill="currentColor" stroke="none"/></svg>`;
const iconTimeline = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="5" r="1.5"/><circle cx="13" cy="10" r="1.5"/><path d="M4.5 8h2L8 6.5"/><path d="M9.5 5.5l2 3.5"/></svg>`;
const iconIncident = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L1.5 13.5h13L8 2z"/><path d="M8 6v4"/><circle cx="8" cy="11.5" r="0.5" fill="currentColor"/></svg>`;
const iconAI = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="12" height="9" rx="2"/><path d="M5 4V2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V4"/><path d="M8 8v2"/><circle cx="5.5" cy="8" r="1"/><circle cx="10.5" cy="8" r="1"/></svg>`;
const iconSettings = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg>`;
const iconUser = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>`;
const iconBell = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M8 14c0.7 0 1.3-0.6 1.3-1.3H6.7C6.7 13.4 7.3 14 8 14z"/><path d="M8 2a5.3 5.3 0 0 0-5.3 5.3V11h10.7V7.3A5.3 5.3 0 0 0 8 2z"/></svg>`;
const iconGear = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4"/></svg>`;
const iconChevron = () => `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;color:var(--text-muted);"><path d="M3 4.5l3 3 3-3"/></svg>`;
const iconSearchSm = () => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><circle cx="7" cy="7" r="4"/><path d="M15 15l-3.5-3.5"/></svg>`;
