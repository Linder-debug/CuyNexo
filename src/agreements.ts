import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { calculateNetting, type NettingInput, type NettingResult } from "./netting.js";

export interface AgreementDraft extends NettingInput {
  transactionSourceId: string;
  feeCapAtomic: string;
  consentBy: number;
}

export interface FrozenAgreement extends AgreementDraft, NettingResult {
  roundId: string;
  version: number;
  network: "stellar-testnet";
  asset: "XLM";
  settleBy: number;
  specVersion: "0.3";
}

export type ConsentDecision = "ACCEPT" | "REJECT";
export interface SyntheticConsent {
  roundId: string;
  version: number;
  agreementHash: string;
  participantId: string;
  decision: ConsentDecision;
}

type VersionStatus =
  | "PENDING_CONSENT" | "APPROVED" | "NET_ZERO"
  | "REJECTED" | "SUPERSEDED" | "EXPIRED" | "CANCELLED";

interface VersionRow {
  payload: string;
  hash: string;
  status: VersionStatus;
}

interface RecordedConsent {
  participantId: string;
  decision: ConsentDecision;
  receivedAt: number;
}

export interface AgreementView {
  agreement: FrozenAgreement;
  hash: string;
  status: VersionStatus;
  consents: RecordedConsent[];
  validApprovalCount: number;
  canAdvance: boolean;
}

export class AgreementError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "INVALID_CONSENT" | "INVALID_STATE"
      | "NOT_FOUND" | "VERSION_CONFLICT" | "ROUND_ACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "AgreementError";
  }
}

const SETTLEMENT_WINDOW_MS = 10 * 60 * 1000;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    closed_at INTEGER
  ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS single_open_round ON rounds ((1)) WHERE closed_at IS NULL;

  CREATE TABLE IF NOT EXISTS agreement_versions (
    round_id TEXT NOT NULL REFERENCES rounds(id),
    version INTEGER NOT NULL CHECK (version >= 1),
    payload TEXT NOT NULL,
    hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
      'PENDING_CONSENT', 'APPROVED', 'NET_ZERO', 'REJECTED', 'SUPERSEDED', 'EXPIRED', 'CANCELLED'
    )),
    PRIMARY KEY (round_id, version),
    UNIQUE (round_id, version, hash)
  ) STRICT;

  CREATE TRIGGER IF NOT EXISTS immutable_version
  BEFORE UPDATE OF round_id, version, payload, hash ON agreement_versions
  BEGIN
    SELECT RAISE(ABORT, 'Agreement version is immutable');
  END;

  CREATE TABLE IF NOT EXISTS synthetic_consents (
    round_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    agreement_hash TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('ACCEPT', 'REJECT')),
    received_at INTEGER NOT NULL,
    PRIMARY KEY (round_id, version, participant_id),
    FOREIGN KEY (round_id, version, agreement_hash)
      REFERENCES agreement_versions (round_id, version, hash)
  ) STRICT;
`;

function canonicalJson(value: unknown): string {
  // All payload values are generated from validated ASCII strings and safe integers.
  // RFC 8785 orders object keys by UTF-16 and preserves the array order.
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const object = value as Record<string, unknown>;
  const fields = Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(object[key])}`);
  return `{${fields.join(",")}}`;
}

function isLive(status: VersionStatus): boolean {
  return status === "PENDING_CONSENT" || status === "APPROVED";
}

export class AgreementStore {
  private readonly db: DatabaseSync;

  constructor(path: string, private readonly clock: () => number = Date.now) {
    this.db = new DatabaseSync(path);
    try {
      this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
      this.transaction(() => this.db.exec(SCHEMA));
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  createRound(roundId: string): void {
    if (typeof roundId !== "string" || !roundId || /[^!-~]/.test(roundId)) {
      throw new AgreementError("INVALID_INPUT", "A round ID must be nonempty printable ASCII without spaces");
    }
    this.transaction(() => {
      if (this.db.prepare("SELECT id FROM rounds WHERE id = ?").get(roundId)) {
        throw new AgreementError("INVALID_INPUT", "Round ID already exists");
      }
      if (this.db.prepare("SELECT id FROM rounds WHERE closed_at IS NULL").get()) {
        throw new AgreementError("ROUND_ACTIVE", "An active round already exists");
      }
      this.db.prepare("INSERT INTO rounds (id, created_at) VALUES (?, ?)").run(roundId, this.clock());
    });
  }

  closeRound(roundId: string, expectedVersion: number | null): void {
    this.transaction(() => {
      const latest = this.requireCurrent(roundId, expectedVersion);
      const now = this.clock();
      if (latest) {
        const status = this.refreshStatus(latest.row, latest.agreement, now);
        if (isLive(status)) this.updateStatus(roundId, latest.agreement.version, "CANCELLED");
      }
      this.db.prepare("UPDATE rounds SET closed_at = ? WHERE id = ?").run(now, roundId);
    });
  }

  freezeVersion(roundId: string, expectedVersion: number | null, draft: AgreementDraft): AgreementView {
    const netting = calculateNetting(draft);
    if (!draft.participants.includes(draft.transactionSourceId)
      || typeof draft.feeCapAtomic !== "string"
      || !/^(0|[1-9][0-9]*)$/.test(draft.feeCapAtomic)
      || draft.feeCapAtomic !== draft.feeCapAtomic.trim()
      || !Number.isSafeInteger(draft.consentBy)
      || !Number.isSafeInteger(draft.consentBy + SETTLEMENT_WINDOW_MS)) {
      throw new AgreementError("INVALID_INPUT", "Invalid transaction source, fee cap or consent deadline");
    }
    return this.transaction(() => {
      const latest = this.requireCurrent(roundId, expectedVersion);
      const now = this.clock();
      if (draft.consentBy <= now) {
        throw new AgreementError("INVALID_INPUT", "Consent deadline must be in the future");
      }
      if (latest) {
        const status = this.refreshStatus(latest.row, latest.agreement, now);
        if (status === "NET_ZERO") {
          throw new AgreementError("INVALID_STATE", "A completed zero-net round must be closed");
        }
        if (isLive(status)) this.updateStatus(roundId, latest.agreement.version, "SUPERSEDED");
      }

      const agreement: FrozenAgreement = {
        roundId,
        version: (latest?.agreement.version ?? 0) + 1,
        network: "stellar-testnet",
        asset: "XLM",
        participants: [...draft.participants].sort(),
        obligations: draft.obligations.map(({ obligationId, debtorId, creditorId, amountAtomic }) =>
          ({ obligationId, debtorId, creditorId, amountAtomic }))
          .sort((left, right) => left.obligationId < right.obligationId ? -1 : left.obligationId > right.obligationId ? 1 : 0),
        ...netting,
        transactionSourceId: draft.transactionSourceId,
        feeCapAtomic: draft.feeCapAtomic,
        consentBy: draft.consentBy,
        settleBy: draft.consentBy + SETTLEMENT_WINDOW_MS,
        specVersion: "0.3",
      };
      const payload = canonicalJson(agreement);
      const hash = createHash("sha256").update(payload, "utf8").digest("hex");
      this.db.prepare(`
        INSERT INTO agreement_versions (round_id, version, payload, hash, status)
        VALUES (?, ?, ?, ?, 'PENDING_CONSENT')
      `).run(roundId, agreement.version, payload, hash);
      return this.view(agreement, hash, "PENDING_CONSENT", []);
    });
  }

  getVersion(roundId: string, version: number): AgreementView {
    return this.transaction(() => {
      const row = this.findVersion(roundId, version);
      if (!row) throw new AgreementError("NOT_FOUND", "Agreement version not found");
      const agreement = this.decodeVersion(row);
      const status = this.refreshStatus(row, agreement, this.clock());
      return this.view(agreement, row.hash, status, this.readConsents(roundId, version));
    });
  }

  recordConsent(input: SyntheticConsent): AgreementView {
    const { roundId, version, agreementHash, participantId, decision } = input;
    const invalid = new AgreementError("INVALID_CONSENT", "Consent does not match an eligible agreement version");
    if (typeof roundId !== "string" || !Number.isSafeInteger(version) || version < 1
      || (decision !== "ACCEPT" && decision !== "REJECT")) throw invalid;

    const result = this.transaction(() => {
      const row = this.findVersion(roundId, version);
      if (!row || row.hash !== agreementHash) return invalid;
      const agreement = this.decodeVersion(row);
      const now = this.clock();
      const status = this.refreshStatus(row, agreement, now);
      // Return eligibility failures inside the transaction so observed expiration is committed.
      if (now >= agreement.consentBy || !agreement.participants.includes(participantId)) return invalid;
      const latest = this.findVersion(roundId);
      const round = this.db.prepare("SELECT closed_at FROM rounds WHERE id = ?").get(roundId);
      if (round?.closed_at !== null || latest?.hash !== row.hash) return invalid;

      const consents = this.readConsents(roundId, version);
      const existing = consents.find((consent) => consent.participantId === participantId);
      if (existing?.decision === decision) return this.view(agreement, row.hash, status, consents);
      if (existing || status !== "PENDING_CONSENT") return invalid;

      this.db.prepare(`
        INSERT INTO synthetic_consents (round_id, version, agreement_hash, participant_id, decision, received_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(roundId, version, row.hash, participantId, decision, now);
      const recorded = this.readConsents(roundId, version);
      let nextStatus: VersionStatus = "PENDING_CONSENT";
      if (decision === "REJECT") {
        nextStatus = "REJECTED";
      } else if (recorded.length === agreement.participants.length) {
        nextStatus = agreement.payments.length === 0 ? "NET_ZERO" : "APPROVED";
      }
      if (nextStatus !== status) this.updateStatus(roundId, version, nextStatus);
      return this.view(agreement, row.hash, nextStatus, recorded);
    });
    if (result instanceof AgreementError) throw result;
    return result;
  }

  private transaction<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private findVersion(roundId: string, version?: number): VersionRow | undefined {
    return (version === undefined
      ? this.db.prepare("SELECT payload, hash, status FROM agreement_versions WHERE round_id = ? ORDER BY version DESC LIMIT 1").get(roundId)
      : this.db.prepare("SELECT payload, hash, status FROM agreement_versions WHERE round_id = ? AND version = ?").get(roundId, version)
    ) as VersionRow | undefined;
  }

  private decodeVersion(row: VersionRow): FrozenAgreement {
    if (createHash("sha256").update(row.payload, "utf8").digest("hex") !== row.hash) {
      throw new AgreementError("INVALID_STATE", "Stored agreement does not match its hash");
    }
    return JSON.parse(row.payload) as FrozenAgreement;
  }

  private requireCurrent(roundId: string, expectedVersion: number | null) {
    const round = this.db.prepare("SELECT closed_at FROM rounds WHERE id = ?").get(roundId);
    if (!round) throw new AgreementError("NOT_FOUND", "Round not found");
    if (round.closed_at !== null) throw new AgreementError("INVALID_STATE", "Round is closed");
    const row = this.findVersion(roundId);
    const agreement = row && this.decodeVersion(row);
    if ((agreement?.version ?? null) !== expectedVersion) {
      throw new AgreementError("VERSION_CONFLICT", "The current version changed");
    }
    return row && agreement ? { row, agreement } : undefined;
  }

  private readConsents(roundId: string, version: number): RecordedConsent[] {
    return this.db.prepare(`
      SELECT participant_id AS participantId, decision, received_at AS receivedAt
      FROM synthetic_consents WHERE round_id = ? AND version = ? ORDER BY participant_id
    `).all(roundId, version).map(({ participantId, decision, receivedAt }) => ({
      participantId: participantId as string,
      decision: decision as ConsentDecision,
      receivedAt: receivedAt as number,
    }));
  }

  private updateStatus(roundId: string, version: number, status: VersionStatus): void {
    this.db.prepare("UPDATE agreement_versions SET status = ? WHERE round_id = ? AND version = ?")
      .run(status, roundId, version);
  }

  private refreshStatus(row: VersionRow, agreement: FrozenAgreement, now: number): VersionStatus {
    if ((row.status === "PENDING_CONSENT" && now >= agreement.consentBy)
      || (row.status === "APPROVED" && now >= agreement.settleBy)) {
      this.updateStatus(agreement.roundId, agreement.version, "EXPIRED");
      return "EXPIRED";
    }
    return row.status;
  }

  private view(
    agreement: FrozenAgreement, hash: string, status: VersionStatus, consents: RecordedConsent[],
  ): AgreementView {
    return {
      agreement, hash, status, consents,
      validApprovalCount: isLive(status) ? consents.filter(({ decision }) => decision === "ACCEPT").length : 0,
      canAdvance: status === "APPROVED",
    };
  }
}
