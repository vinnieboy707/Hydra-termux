# Backend Controller: API Aggregation & Audit Integration
# Purpose: Functional implementation of API data fetching with mandatory audit logging.

import sys
import os

# Add parent directory to path to import the auth module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from auth.auth_module import validate_key, log_audit

def fetch_api_data(api_key, endpoint):
    """Fetches API data and logs the request to the audit system."""
    
    # 1. Strict Mode Validation
    if not api_key:
        return {"status": "ERROR", "message": "Missing API Key"}, 403
        
    auth_data = validate_key(api_key)
    if not auth_data:
        return {"status": "ERROR", "message": "Invalid API Key"}, 403
    
    # 2. Functional Implementation (Stub for actual data fetch)
    # The spec mandates integration with the audit log for ALL backend requests.
    log_audit(api_key, endpoint)
    
    # Simulate data aggregation
    return {
        "status": "SUCCESS",
        "data": f"Aggregated data for {endpoint}",
        "tier": auth_data['tier']
    }, 200
