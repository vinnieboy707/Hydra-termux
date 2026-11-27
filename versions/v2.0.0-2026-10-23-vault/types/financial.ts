/**
 * financial.ts
 *
 * Strict TypeScript definitions synchronized with PostgreSQL tables, Firebase documents, and WAL ledger entries.
 */

export interface RevenueStream {
  id: number;
  streamIdentifier: string;
  streamName: string;
  category: string;
  allocationWeight: number;
  status: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id?: number;
  txId: string;
  timestamp: string;
  streamId: string;
  streamName: string;
  category: string;
  revenueUSD: number;
  treasuryAllocation: number;
  spendableTapToPayAllocation: number;
  status: string;
  previousHash: string;
  hash: string;
}

export interface TapToPayTransaction {
  id?: number;
  txId: string;
  timestamp: string;
  spendAmountUSD: number;
  status: string;
}

export interface ComplianceAuditRecord {
  id?: number;
  timestamp: string;
  auditEvent: string;
  complianceStatus: string;
  ledgerHash: string;
}

export interface FailureLogRecord {
  id?: number;
  timestamp: string;
  errorSignature: string;
  rootCause: string;
  resolutionAction: string;
  status: string;
}

export interface AdaptiveOptimizerState {
  timestamp: string;
  params: {
    minProfitSpread: number;
    maxGasGwei: number;
    slippageTolerance: number;
  };
  goldenBaseline: {
    minProfitSpread: number;
    maxGasGwei: number;
    slippageTolerance: number;
  };
  consecutiveSuccesses: number;
  consecutiveFailures: number;
}
