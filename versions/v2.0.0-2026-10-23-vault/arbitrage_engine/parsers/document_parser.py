import re
from typing import Dict, Any

class ParsedFiling:
    def __init__(self, record_id: str, filing_date: str, apn: str, valuation: str, description: str):
        self.record_id = record_id
        self.filing_date = filing_date
        self.apn = apn
        self.valuation = valuation
        self.description = description

    def model_dump(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "filing_date": self.filing_date,
            "apn": self.apn,
            "valuation": self.valuation,
            "description": self.description
        }

class DocumentParser:
    @staticmethod
    def parse_public_filing(raw_text: str, jurisdiction: str) -> ParsedFiling:
        rec_match = re.search(r"(?:Permit|Doc)\s*#?([A-Za-z0-9\-]+)", raw_text)
        record_id = rec_match.group(1) if rec_match else "UNKNOWN-ID"

        date_match = re.search(r"(?:Filed|Recorded):\s*([0-9\/\-]+)", raw_text)
        filing_date = date_match.group(1) if date_match else "2026-10-10"

        apn_match = re.search(r"APN\s*#?([0-9\-]+)", raw_text)
        apn = apn_match.group(1) if apn_match else "UNASSIGNED"

        val_match = re.search(r"Valuation\s*\$([0-9,]+)", raw_text)
        valuation = val_match.group(1).replace(",", "") if val_match else "0"

        desc = raw_text.split("Valuation")[-1].strip() if "Valuation" in raw_text else raw_text

        return ParsedFiling(
            record_id=record_id,
            filing_date=filing_date,
            apn=apn,
            valuation=valuation,
            description=desc
        )
