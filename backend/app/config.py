import os
from pathlib import Path
REDIS_URL=os.getenv("REDIS_URL","redis://localhost:6379/0")
DATA_DIR=Path(os.getenv("DATA_DIR",str(Path(__file__).resolve().parents[1]/"data")))
DATABASE_PATH=os.getenv("DATABASE_PATH",str(DATA_DIR/"taxcloud.db"))
REQUIRED=["Transaction ID","Share Name","Purchase Price","Selling Price","Quantity"]
