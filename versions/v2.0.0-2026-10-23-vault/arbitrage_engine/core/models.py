import hashlib
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Record(Base):
    __tablename__ = "records"

    record_hash = Column(String(64), primary_key=True)
    jurisdiction = Column(String(64), nullable=False, index=True)
    stream_type = Column(String(64), nullable=False, index=True)
    raw_payload = Column(Text, nullable=False)
    processed_json = Column(Text, nullable=False)
    ingested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    is_billed = Column(Boolean, default=False, nullable=False, index=True)

    @staticmethod
    def generate_hash(jurisdiction: str, identifier: str, filing_date: str) -> str:
        payload = f"{jurisdiction}:{identifier}:{filing_date}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()
