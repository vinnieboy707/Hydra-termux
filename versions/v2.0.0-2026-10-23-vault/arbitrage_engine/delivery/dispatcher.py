import os
import csv
import json
from pathlib import Path
from sqlalchemy.orm import Session
from core.models import Record, ClientEndpoint

class DeliveryDispatcher:
    def __init__(self, session: Session, export_dir: str = "./data/processed"):
        self.session = session
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def export_morning_csv(self, client: ClientEndpoint) -> str:
        records = self.session.query(Record).filter(Record.is_billed == False).all()
        filepath = self.export_dir / f"morning_feed_{client.id}_{os.urandom(3).hex()}.csv"

        with open(filepath, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Record_Hash", "Jurisdiction", "Stream",
                "Filing_Date", "Amount", "APN_Parcel", "Job_Description"
            ])
            for r in records:
                p = json.loads(r.processed_json)
                writer.writerow([
                    r.record_hash, r.jurisdiction, r.stream_type,
                    p.get("filing_date"), p.get("amount"),
                    p.get("apn_parcel"), p.get("job_description")
                ])
                r.is_billed = True

        self.session.commit()
        return str(filepath)
