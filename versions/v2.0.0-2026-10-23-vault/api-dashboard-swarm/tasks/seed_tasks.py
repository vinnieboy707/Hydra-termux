# Seeding the updated task graph
import sqlite3
import os

DB_PATH = 'coordinator/swarm.db'

def seed_tasks():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Clear existing tasks
    cursor.execute('DELETE FROM tasks')
    
    tasks = [
        # Phase 1: Spec
        ('spec-research', 'spec-agent', 'Research Public API documentation', None, 'queued'),
        
        # Phase 2: Schema
        ('define-schema', 'schema-agent', 'Define unified DB schema', 'spec-research', 'queued'),
        
        # Phase 3: Backend
        ('backend-general-api', 'backend-agent', 'Fetch/normalize general APIs', 'define-schema', 'queued'),
        
        # Phase 4: Auth
        ('auth-flow', 'auth-agent', 'Implement Open Banking OAuth', 'backend-general-api', 'queued'),
        
        # Phase 5: Frontend
        ('frontend-dashboard', 'frontend-agent', 'Build dashboard UI', 'auth-flow', 'queued'),
        
        # Phase 6: Webhooks
        ('webhook-integration', 'webhook-agent', 'Setup secure webhook endpoints', 'frontend-dashboard', 'queued'),
        
        # Phase 7: Tests
        ('automated-tests', 'test-agent', 'Run comprehensive system tests', 'webhook-integration', 'queued'),
        
        # Phase 8: Audit
        ('automated-audit', 'auditor-agent', 'Perform final security and compliance audit', 'automated-tests', 'queued'),
        
        # Phase 9: Deploy
        ('final-deploy', 'deploy-agent', 'Package and deploy application', 'automated-audit', 'queued')
    ]
    for task in tasks:
        try:
            cursor.execute('INSERT INTO tasks (id, role, description, depends_on, status) VALUES (?, ?, ?, ?, ?)', task)
            print(f"DEBUG: Inserted {task[0]}")
        except Exception as e:
            print(f"DEBUG: Failed to insert {task[0]}: {e}")
    
    conn.commit()
    conn.close()
    print("Tasks seeded successfully.")

if __name__ == '__main__':
    seed_tasks()
