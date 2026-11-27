# Coordinator module for task graph and findings management
import sqlite3
import os

DB_PATH = 'coordinator/swarm.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the coordinator database."""
    conn = get_db()
    cursor = conn.cursor()
    # Tasks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            role TEXT,
            description TEXT,
            depends_on TEXT,
            status TEXT DEFAULT 'queued',
            attempts INTEGER DEFAULT 0
        )
    ''')
    # Findings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT,
            task_id TEXT,
            finding TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def status_report():
    """Returns a status summary of all tasks."""
    conn = get_db()
    tasks = conn.execute('SELECT status, count(*) FROM tasks GROUP BY status').fetchall()
    conn.close()
    return {status: count for status, count in tasks}

def mark_task_done(task_id):
    """Marks task as succeeded and promotes dependencies."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE tasks SET status = "succeeded" WHERE id = ?', (task_id,))
    
    # Find tasks that depended on this one
    dependent_tasks = conn.execute('SELECT id, depends_on FROM tasks WHERE depends_on = ?', (task_id,)).fetchall()
    for task in dependent_tasks:
        # Check if all dependencies for this task are met
        # (Simplified: assumes task depends only on the one just completed)
        cursor.execute('UPDATE tasks SET status = "runnable" WHERE id = ?', (task['id'],))
        
    conn.commit()
    conn.close()
    print(f"Task {task_id} marked as succeeded.")

def get_runnable_tasks():
    """Returns tasks that are runnable."""
    conn = get_db()
    runnable = conn.execute('SELECT id, role FROM tasks WHERE status = "runnable" OR (status = "queued" AND depends_on IS NULL)').fetchall()
    conn.close()
    return runnable


if __name__ == '__main__':
    if not os.path.exists('coordinator'):
        os.makedirs('coordinator')
    init_db()
    print("Database initialized.")
    print(f"Status report: {status_report()}")
