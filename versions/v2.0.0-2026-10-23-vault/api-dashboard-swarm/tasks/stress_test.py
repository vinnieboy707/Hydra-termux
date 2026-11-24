# Stress test script to simulate task load and failure
import sqlite3
import random
import time
from coordinator.coordinator import get_db

def simulate_stress():
    print("Starting stress test...")
    conn = get_db()
    # Simulate massive influx of tasks
    for i in range(100):
        task_id = f"stress-{i}"
        role = random.choice(['backend-agent', 'auth-agent', 'frontend-agent'])
        conn.execute('INSERT INTO tasks (id, role, description) VALUES (?, ?, ?)', 
                     (task_id, role, f"Stress task {i}"))
    conn.commit()
    conn.close()
    print("Stress test: 100 tasks injected.")

if __name__ == '__main__':
    simulate_stress()
