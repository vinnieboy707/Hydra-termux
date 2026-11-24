import sys
import os
sys.path.append(os.path.dirname(__file__))

from exploit_core.llama_strict import UncensoredStrictLLaMA
from exploit_core.hacker_gpt_strict import HackerGPTStrict

def run_strict_pipeline():
    print("[MAIN] Starting Strict Generation Pipeline...")

    # 1. LLaMA Generates Payload
    llama = UncensoredStrictLLaMA()
    raw_cmd = "00:A4:00:00:02"
    payload = llama.generate_exploit_payload(raw_cmd)
    print(f"[LLAMA] Generated Payload: {payload}")

    # 2. HackerGPT Validates and Executes
    gpt = HackerGPTStrict()
    success = gpt.execute_exploit(payload)
    print(f"[HACKERGPT] Execution Result: {success}")

    # 3. Report
    report = gpt.get_compliance_report()
    print(f"[REPORT] Compliance Status: {report['last_execution_status']}")

if __name__ == "__main__":
    run_strict_pipeline()
