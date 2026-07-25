# RiskFusion AI
### AI-Powered Banking Incident Correlation Platform
**Built for FinSpark 2026 Hackathon**

---

## Overview

**RiskFusion AI** is a premium enterprise-grade SOC (Security Operations Centre) prototype built for banking institutions. It monitors cybersecurity telemetry and banking transaction behaviour in a unified platform, helping security analysts investigate sophisticated banking attacks.

Inspired by Microsoft Sentinel, Google Chronicle, Palo Alto Cortex XSIAM, and Splunk Enterprise Security.

---

## Pages / Screens

| File | Page | Description |
|------|------|-------------|
| `index.html` | **Login** | Enterprise SSO + credential login with brand panel |
| `dashboard.html` | **SOC Dashboard** | Real-time KPIs, heatmap, event stream, incident table, world map |
| `incidents.html` | **Incident Queue** | Full incident management with filters, bulk actions, SLA tracking |
| `investigation.html` | **Investigations** | Active investigation workspace, analyst workload, evidence panel |
| `analytics.html` | **Analytics** | Customer behaviour, transaction, device and geo risk analytics |
| `incident.html` | **Incident Details** | Risk gauge, correlated signals, timeline, recommended actions |
| `ai.html` | **AI Analyst Report** | Structured investigation report with reasoning chain and confidence |
| `killchain.html` | **Attack Kill Chain** | Interactive horizontal kill chain with event detail panel |

---

## Folder Structure

```
FineSpark/
├── index.html                  # Login page
├── dashboard.html              # SOC Dashboard
├── incidents.html              # Incident Queue
├── investigation.html          # Investigations Workspace
├── analytics.html              # Analytics
├── incident.html               # Incident Details
├── ai.html                     # AI Analyst Report
├── killchain.html              # Attack Kill Chain
│
├── styles/
│   └── design-system.css       # Complete design system, tokens, components
│
├── scripts/
│   ├── app.js                  # Shared utilities — ripple, tooltip, time
│   └── shell.js                # Sidebar + navbar injection for all pages
│
└── assets/
    ├── icons/                  # SVG icons (inline in code)
    ├── illustrations/          # Login panel illustrations
    ├── logos/                  # Product and bank logos
    └── screenshots/            # Prototype screenshots for presentation
```

---

## Design System

| Token | Value |
|-------|-------|
| Primary Background | `#F8FAFC` |
| Surface (Cards) | `#FFFFFF` |
| Brand Blue | `#2563EB` |
| Brand Cyan | `#06B6D4` |
| Critical | `#DC2626` |
| High | `#EA580C` |
| Medium | `#D97706` |
| Low | `#059669` |
| Border Radius (Cards) | `18px` |
| Font | Inter (Google Fonts) |

---

## How to Run

1. Open any `.html` file directly in a browser (no server needed)
2. Navigate using the sidebar — all 8 pages are linked
3. Start from `index.html` (Login → Dashboard)

**Recommended:** Use a local server for best performance:
```bash
npx serve .
# or
python -m http.server 3000
```

Then open: `http://localhost:3000`

## Backend API

The FastAPI backend lives in [`backend/`](backend/README.md). It uses SQLite and seeds realistic banking-risk incidents automatically on first start.

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` to explore the dashboard, incidents, incident detail, and analytics endpoints.

---

## Key Features Demonstrated

- **Real-time SOC Dashboard** — KPI cards, incident heatmap, live event stream, world map
- **Incident Queue** — Sortable table, bulk actions, SLA timers, severity filters
- **Investigation Workspace** — Progress tracking, analyst workload, evidence collection
- **Analytics** — Customer behaviour, transaction, device and geo risk analysis
- **Correlated Signals** — 7 evidence signals per incident (impossible travel, VPN, new device…)
- **AI Analyst Report** — Structured reasoning chain, confidence score, MITRE ATT&CK mapping
- **Attack Kill Chain** — Interactive 6-stage timeline with IoC detail panel

---

## Demo Incident

All screens are pre-populated with a realistic **Account Takeover** scenario:

- **Incident ID:** INC-2026-0847
- **Customer:** Arjun Kapoor (CUS-84721) · HDFC Bank
- **Attack:** Mumbai login → Moscow impossible travel → ₹14.72L wire transfer
- **Risk Score:** 94/100 (Critical)
- **AI Confidence:** 96.4%
- **MITRE Techniques:** T1078, T1550, T1190, T1090, T1098, T1020

---

## Tech Stack

- **HTML5** — Semantic markup
- **Vanilla CSS** — Design system, glassmorphism, animations
- **Vanilla JavaScript** — Navigation, interactivity, chart data
- **Chart.js v4** — Incident trend, risk distribution, heatmap, analytics charts
- **No framework** — Zero dependencies except Chart.js CDN

---

*FinSpark 2026 Hackathon · RiskFusion AI Prototype v1.0 · Not for production use*
