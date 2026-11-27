# AAI App - Cloud Deployment Guide

## 1. Containerization
The application is pre-configured for containerization:
- **Dockerfile:** Standard Node.js 20-slim environment.
- **Docker Compose:** Simplifies orchestration, mapping local DB volumes for persistence.

## 2. Cloud Deployment (Google Cloud Run)
Google Cloud Run is the recommended platform for this serverless, scalable architecture.

### Steps:
1. **Build Container:**
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/aai-app
   ```
2. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy aai-app --image gcr.io/[PROJECT_ID]/aai-app --platform managed --region us-central1 --allow-unauthenticated
   ```

## 3. Production Hardening
- **Secrets Management:** Ensure `GEMINI_API_KEY` and other sensitive variables are injected via Google Secret Manager and mapped as environment variables at runtime in the Cloud Run service configuration.
- **IAM:** Use a dedicated IAM Service Account with least-privilege access to Vertex AI APIs.
- **Persistence:** In Cloud Run, utilize Cloud SQL or Firestore instead of local SQLite for high-availability production storage.
