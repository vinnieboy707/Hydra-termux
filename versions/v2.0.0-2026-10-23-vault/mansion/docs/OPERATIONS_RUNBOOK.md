# AAI App - Enterprise Operations Runbook

## 1. Overview
The **Abandoned Asset Intelligence (AAI) App** is a high-signal full-stack platform that correlates property distress indicators with public incarceration and real-time web intelligence.

## 2. Architecture
- **Backend:** Node.js/Express (TypeScript).
- **Database:** SQLite (local persistence).
- **Process Management:** PM2 (Multi-port deployment).
- **Intelligence Suite:**
  - **Fuzzy Correlation:** Jaro-Winkler name matching.
  - **AI Engine:** Google Gemini (Multimodal/Text analysis).
  - **Search Engine:** Real-time web integration (SerpApi/Webz.io).
  - **CPRA Engine:** Automated document generation for county-level sentencing records.

## 3. Deployment
The application is configured for multi-port deployment using `pm2`.

### Initial Setup
1. Install dependencies: `npm install`
2. Install PM2: `npm install -g pm2`

### Launching Services
Execute the following from the project root (`/1/2/3/`):
```bash
pm2 start ecosystem.config.js
```

### Verification
Run `pm2 status` to ensure all instances (`aai-app-3000`, `aai-app-3001`, `aai-app-3002`) are **online**.

## 4. Maintenance
- **Data Sync:** Trigger a full sync and re-correlation of property and inmate data via:
  `POST /api/trigger-sync`
- **Logs:** Monitor application logs in real-time:
  `pm2 logs`
- **Database Backup:** Periodically backup the SQLite database file:
  `/database/mansion_mesh.db`

## 5. Troubleshooting
| Issue | Potential Cause | Resolution |
| :--- | :--- | :--- |
| API Unavailable | Port conflict or process crash | Check `pm2 status`. If crashed, `pm2 restart <name>`. |
| Database Error | Lock contention | Ensure only authorized processes access the `.db` file. |
| Sync Failing | External API/Site changes | Check `scrapeCondemnedInmates` logic in `inmateService.js` for DOM structure updates. |

## 6. Incident Response
For critical production failures:
1.  **Isolate:** Restart impacted instances via `pm2 restart <app_name>`.
2.  **Inspect:** Analyze logs using `pm2 logs <app_name> --lines 100`.
3.  **Rollback:** If recent changes caused the failure, revert to the previous Git commit and redeploy.

## 7. Data Pipeline Integration
To enable real-world data pipelines:
1. **Search Integration:** Configure `services/adapters/searchAdapter.ts` with your provider API key.
2. **AI Integration:** Set `GEMINI_API_KEY` in environment.
3. **Data Mode:** Set `DATA_MODE=production` to switch from mock adapters to live API endpoints.
