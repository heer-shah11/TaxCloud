import sqlite3
from pathlib import Path
from .config import DATABASE_PATH, DATA_DIR

def db():
    Path(DATABASE_PATH).parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DATABASE_PATH,timeout=30)
    c.row_factory=sqlite3.Row
    return c

def init():
    DATA_DIR.mkdir(parents=True,exist_ok=True)
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,filename TEXT,status TEXT,current_step INTEGER,total_rows INTEGER,worker_count INTEGER DEFAULT 2,batch_size INTEGER DEFAULT 500,tax_rate REAL DEFAULT 0.1,total_batches INTEGER DEFAULT 0,completed_batches INTEGER DEFAULT 0,failed_batches INTEGER DEFAULT 0,error TEXT,created_at TEXT);
        CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,job_id TEXT,batch_number INTEGER,status TEXT,worker_name TEXT,error TEXT);
        CREATE TABLE IF NOT EXISTS results(id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT,transaction_id TEXT,share_name TEXT,purchase_price REAL,selling_price REAL,quantity REAL,profit REAL,demo_tax REAL,batch_number INTEGER);
        """)
