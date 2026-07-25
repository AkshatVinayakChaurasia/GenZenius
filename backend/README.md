# RiskFusion AI Backend

FastAPI service for the RiskFusion AI banking-security prototype. On first start it creates a SQLite database and loads six realistic incidents.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`; interactive documentation is at `/docs`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | KPI cards, incident trend, and risk distribution |
| GET | `/incidents` | Incident queue, newest first |
| GET | `/incident/{id}` | Full incident with signals, timeline, and actions |
| GET | `/analytics` | Severity, type, status, geography, transaction, and model metrics |

Example incident: `/incident/INC-2026-0847`.
