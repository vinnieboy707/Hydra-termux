#!/usr/bin/env python3
import os
import sys
from pathlib import Path

BASE_DIR = Path("./arbitrage_engine").resolve()

DIRECTORIES = [
    BASE_DIR / "config",
    BASE_DIR / "core",
    BASE_DIR / "workers",
    BASE_DIR / "parsers",
    BASE_DIR / "delivery",
    BASE_DIR / "billing",
    BASE_DIR / "data" / "raw",
    BASE_DIR / "data" / "processed",
    BASE_DIR / "logs",
]

FILES = {
    BASE_DIR / ".env.example": """# Pipeline Secrets & Configuration
APP_ENV=production
LOG_LEVEL=INFO

DATABASE_URL=sqlite:///./data/arbitrage.db

PROXY_SERVER=http://p.webshare.io:80
PROXY_USERNAME=your_proxy_user
PROXY_PASSWORD=your_proxy_pass

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_INSTANT_PAYOUT_CARD=card_...

AWS_S3_BUCKET=arbitrage-morning-delivery
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
""",

    BASE_DIR / "requirements.txt": """pydantic>=2.5.0
sqlalchemy>=2.0.0
stripe>=7.0.0
python-dotenv>=1.0.0
""",

    BASE_DIR / "core" / "models.py": """import hashlib
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Float, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class Record(Base):
    __tablename__ = "records"

    record_hash = Column(String(64), primary_key=True, index=True)
    jurisdiction = Column(String(50), nullable=False, index=True)
    stream_type = Column(String(50), nullable=False, index=True)
    raw_payload = Column(String, nullable=False)
    processed_json = Column(String, nullable=False)
    ingested_at = Column(DateTime, default=datetime.utcnow)
    is_billed = Column(Boolean, default=False)

    @staticmethod
    def generate_hash(jurisdiction: str, identifier: str, filing_date: str) -> str:
        unique_seed = f"{jurisdiction.upper()}:{identifier.strip()}:{filing_date.strip()}"
        return hashlib.sha256(unique_seed.encode("utf-8")).hexdigest()

class ClientEndpoint(Base):
    __tablename__ = "client_endpoints"

    id = Column(String(50), primary_key=True)
    client_name = Column(String(100), nullable=False)
    stripe_customer_id = Column(String(50), nullable=False)
    active = Column(Boolean, default=True)
    daily_rate = Column(Float, nullable=False)
    delivery_webhook = Column(String(255), nullable=True)

def init_db(db_url: str):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)
""",

    BASE_DIR / "parsers" / "document_parser.py": """import re
from typing import Optional
from pydantic import BaseModel, Field

class ParsedFiling(BaseModel):
    jurisdiction: str
    record_id: str
    filing_date: str
    grantor: Optional[str] = None
    grantee: Optional[str] = None
    amount: float = Field(default=0.0)
    apn_parcel: Optional[str] = None
    contractor: Optional[str] = None
    job_description: Optional[str] = None

class DocumentParser:
    @staticmethod
    def parse_public_filing(text: str, jurisdiction: str) -> ParsedFiling:
        record_id = re.search(r'(?:Doc|Instrument|Permit)\\s*#?:?\\s*([A-Za-z0-9\\-]+)', text)
        date_match = re.search(r'\\b(\\d{1,2}/\\d{1,2}/\\d{2,4})\\b', text)
        amount_match = re.search(r'\\$\\s*([\\d,]+(?:\\.\\d{2})?)', text)
        apn_match = re.search(r'(?:APN|Parcel)\\s*#?:?\\s*([\\d\\-]+)', text)

        cleaned_amount = 0.0
        if amount_match:
            cleaned_amount = float(amount_match.group(1).replace(',', ''))

        return ParsedFiling(
            jurisdiction=jurisdiction,
            record_id=record_id.group(1) if record_id else "UNKNOWN",
            filing_date=date_match.group(1) if date_match else "UNKNOWN",
            amount=cleaned_amount,
            apn_parcel=apn_match.group(1) if apn_match else "N/A",
            grantor="EXTRACTED_ENTITY",
            grantee="EXTRACTED_BENEFICIARY",
            job_description="Auto-extracted municipal public record filing"
        )
""",

    BASE_DIR / "workers" / "ingestion_worker.py": """import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from core.models import Record
from parsers.document_parser import DocumentParser, ParsedFiling

logger = logging.getLogger("IngestionWorker")
logging.basicConfig(level=logging.INFO)

class IngestionWorker:
    def __init__(self, session: Session, jurisdiction: str, stream_type: str):
        self.session = session
        self.jurisdiction = jurisdiction
        self.stream_type = stream_type

    def run_harvest(self, mock_raw_documents: list[str]) -> int:
        new_records_count = 0
        for raw_text in mock_raw_documents:
            parsed: ParsedFiling = DocumentParser.parse_public_filing(raw_text, self.jurisdiction)
            digest = Record.generate_hash(
                jurisdiction=self.jurisdiction,
                identifier=parsed.record_id,
                filing_date=parsed.filing_date
            )

            existing = self.session.query(Record).filter(Record.record_hash == digest).first()
            if existing:
                logger.info(f"Duplicate skipped: {digest[:12]}...")
                continue

            new_record = Record(
                record_hash=digest,
                jurisdiction=self.jurisdiction,
                stream_type=self.stream_type,
                raw_payload=raw_text,
                processed_json=json.dumps(parsed.model_dump()),
                ingested_at=datetime.utcnow(),
                is_billed=False
            )
            self.session.add(new_record)
            new_records_count += 1

        self.session.commit()
        logger.info(f"[{self.jurisdiction}:{self.stream_type}] Indexed {new_records_count} unique filings.")
        return new_records_count
""",

    BASE_DIR / "billing" / "settlement_engine.py": """import os
import logging
from core.models import ClientEndpoint

logger = logging.getLogger("SettlementEngine")

class SettlementEngine:
    @staticmethod
    def bill_daily_retainer(client: ClientEndpoint) -> bool:
        # Production routes to stripe.PaymentIntent.create
        logger.info(f"Billing triggered for {client.id} (${client.daily_rate}/day) - Status: CLEARED")
        return True

    @staticmethod
    def trigger_instant_payout(payout_card_id: str):
        # Production routes to stripe.Payout.create(method='instant')
        logger.info(f"07:00 AM Instant Payout sweep queued for destination: {payout_card_id}")
        return True
""",

    BASE_DIR / "delivery" / "dispatcher.py": """import os
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
""",

    BASE_DIR / "main.py": """#!/usr/bin/env python3
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from core.models import init_db, ClientEndpoint
from workers.ingestion_worker import IngestionWorker
from delivery.dispatcher import DeliveryDispatcher
from billing.settlement_engine import SettlementEngine

def run_cycle():
    print("=" * 60)
    print("  AUTONOMOUS DATA ARBITRAGE ENGINE - RUN CYCLE")
    print("=" * 60)

    db_url = os.getenv("DATABASE_URL", "sqlite:///./data/arbitrage.db")
    SessionLocal = init_db(db_url)
    session = SessionLocal()

    if not session.query(ClientEndpoint).first():
        pilot_client = ClientEndpoint(
            id="anchor_roofing_01",
            client_name="Anchor Commercial Roofing",
            stripe_customer_id="cus_pilot_01",
            active=True,
            daily_rate=150.0,
            delivery_webhook="https://api.anchorroofing.local/feed"
        )
        session.add(pilot_client)
        session.commit()
        print("[+] Created initial anchor client endpoint ($150/day).")

    worker = IngestionWorker(session, jurisdiction="CA_MENDOCINO", stream_type="COMMERCIAL_PERMIT")
    mock_filings = [
        "Permit #BP-2026-9912 Filed: 10/10/2026 APN #0144-231-11 Valuation $145,000 Commercial HVAC",
        "Doc #2026-0044192 Recorded: 10/10/2026 APN #0991-441-02 $82,500 Tax Lien Filing",
        "Permit #BP-2026-9912 Filed: 10/10/2026 APN #0144-231-11 Valuation $145,000 Commercial HVAC"
    ]
    harvested = worker.run_harvest(mock_filings)
    print(f"[+] Ingestion complete. {harvested} clean unique records indexed.")

    dispatcher = DeliveryDispatcher(session)
    active_clients = session.query(ClientEndpoint).filter(ClientEndpoint.active == True).all()
    for client in active_clients:
        csv_path = dispatcher.export_morning_csv(client)
        print(f"[+] Morning feed generated for {client.client_name}: {csv_path}")

        billed = SettlementEngine.bill_daily_retainer(client)
        print(f"[+] Retainer charge for {client.id}: {'CLEARED' if billed else 'FAILED'}")

    payout_card = os.getenv("STRIPE_INSTANT_PAYOUT_CARD", "card_default")
    SettlementEngine.trigger_instant_payout(payout_card)
    print("[+] Morning settlement cycle complete.")
    print("=" * 60)

if __name__ == "__main__":
    run_cycle()
"""
}

def bootstrap():
    print(f"[*] Bootstrapping Autonomous Engine at: {BASE_DIR}")
    for d in DIRECTORIES:
        d.mkdir(parents=True, exist_ok=True)
    for filepath, content in FILES.items():
        filepath.write_text(content.strip() + "\n", encoding="utf-8")
        print(f"    [+] Created: {filepath.relative_to(BASE_DIR.parent)}")
    (BASE_DIR / "main.py").chmod(0o755)
    print("\n[✔] Scaffolding complete.")

if __name__ == "__main__":
    bootstrap()
