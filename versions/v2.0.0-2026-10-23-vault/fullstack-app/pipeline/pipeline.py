import sqlite3
import json
import random
import time
from datetime import datetime

# Load configuration
with open('config/config.json') as f:
    config = json.load(f)

db_path = config['database']['path']

def init_db():
    """Creates the SQLite schema if it doesn't exist."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            value REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print("[Python] Database initialized successfully.")

def run_pipeline():
    """Simulates a pipeline ingestion task writing directly to SQLite."""
    print("[Python] Pipeline executing data ingest sequence...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Simulating data collection
    metric_name = "cpu_utilization"
    metric_value = round(random.uniform(20.0, 85.0), 2)
    
    cursor.execute("INSERT INTO metrics (name, value) VALUES (?, ?)", (metric_name, metric_value))
    conn.commit()
    conn.close()
    print(f"[Python] Logged data point: {metric_name} -> {metric_value}")

if __name__ == '__main__':
    init_db()
    run_pipeline()
