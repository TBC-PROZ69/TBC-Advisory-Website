import type { BuyerReport } from "@/lib/buyers/report";
import type { GrantBilling, GrantKind, GrantStatus } from "@/lib/buyers/types";

export type GrantRecord = {
  id: string;
  kind: GrantKind;
  status: GrantStatus;
  createdAt: string;
  expiresAt: string;
  label: string;
  agentName: string;
  agentEmail: string;
  agentLicense: string;
  monthlyCap: number | null;
  spentAt: string | null;
  revokedAt: string | null;
  billing: GrantBilling;
};

export type FileRecord = {
  id: string;
  grantId: string;
  slot: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  storedAt: string;
  storageKey: string;
};

export type ReportRecord = {
  id: string;
  grantId: string;
  createdAt: string;
  monthKey: string;
  overCap: boolean;
  emailed: boolean;
  report: BuyerReport;
};

export type Ledger = {
  version: 1;
  grants: GrantRecord[];
  files: FileRecord[];
  reports: ReportRecord[];
};

export function emptyLedger(): Ledger {
  return { version: 1, grants: [], files: [], reports: [] };
}
