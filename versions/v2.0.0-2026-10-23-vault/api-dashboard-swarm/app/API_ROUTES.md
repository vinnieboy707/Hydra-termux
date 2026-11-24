# API Route Specification (API Dashboard Swarm)

| Route | Method | Purpose | Role |
|---|---|---|---|
| `/api/leads/intake` | POST | Queue a new lead (`source`, `contactInfo`, `details`) | Backend |
| `/api/findings/intake` | POST | Queue a new finding (`program`, `target`, `vulnerabilityType`, `description`, `reproSteps`) | Backend |
| `/api/queue/pending` | GET | List items waiting for human approval | Backend |
| `/api/queue/:id/approve` | POST | Approve item | Auth/Backend |
| `/api/queue/:id/reject` | POST | Reject item | Backend |
| `/api/leads/export-approved`| GET | Export approved leads (human gate) | Backend |
| `/api/findings/:id/confirm-scope`| POST | Second confirmation for finding | Auth/Backend |
| `/api/stripe/webhook` | POST | Secure Stripe webhook receiver | Auth/Webhook |
| `/api/compliance-history` | GET | Audit log | Auditor |
| `/api/oauth/connect` | GET | Start OAuth flow | Auth |
| `/api/oauth/callback` | GET | OAuth callback handler | Auth |
| `/api/oauth/refresh` | POST | Refresh token trigger | Auth |
| `/api/dashboard/stats` | GET | Aggregate API data summary | Frontend/Backend |
