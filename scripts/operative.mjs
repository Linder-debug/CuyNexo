import { DatabaseSync } from 'node:sqlite';
import { Networks, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { randomUUID } from 'node:crypto';
import { AgreementStore } from '../dist/agreements.js';
import { SettlementCoordinator } from '../dist/settlement-coordinator.js';
import { StellarClassicAdapter } from '../dist/stellar-classic.js';
import { calculateNetting } from '../dist/netting.js';
import { consentMessage } from '../dist/consents.js';

export function expect(condition, message) {
  if (!condition) throw Error(message);
}

// A persistent simulated ledger, shared by restarts. Only this transport is available here.
export class Operative {
  constructor(path, clock = Date.now, mode = 'success') {
    this.clock = clock;
    expect(['success','failure','lost-response','before-send'].includes(mode),'Modo simulado inválido');
    this.mode = mode;
    this.db = new DatabaseSync(path);
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    if (tables.length && !tables.some(t => t.name === 'cuynexo_simulation')) {
      this.db.close();
      throw Error('Selecciona un diario exclusivo de simulación');
    }
    this.db.exec('CREATE TABLE IF NOT EXISTS cuynexo_simulation (id INTEGER PRIMARY KEY)');
    this.store = new AgreementStore(path, clock);
    this.db.exec(`CREATE TABLE IF NOT EXISTS web_bodies (
      hash TEXT PRIMARY KEY, prepared TEXT NOT NULL, envelope TEXT NOT NULL, signers TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS simulated_receipts (hash TEXT PRIMARY KEY, receipt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sim_fault (hash TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS sim_hidden (hash TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS simulated_calls (hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS web_retry (hash TEXT PRIMARY KEY, until_ms INTEGER NOT NULL);`);
    this.adapter = new StellarClassicAdapter(this.store, clock);
    this.transport = {
      submit: async tx => {
        const hash = tx.hash().toString('hex');
        const first = this.db.prepare('INSERT OR IGNORE INTO sim_fault VALUES (?)').run(hash).changes;
        if (first && this.mode === 'before-send') throw Error('Interrupción simulada anterior a la llamada');
        this.db.prepare('INSERT INTO simulated_calls VALUES (?)').run(hash);
        const receipt = {hash, successful:this.mode !== 'failure', envelope_xdr:tx.toXDR(),
          operation_count:tx.operations.length, ledger_attr:1, fee_charged:tx.fee};
        this.db.prepare('INSERT OR IGNORE INTO simulated_receipts VALUES (?,?)').run(hash, JSON.stringify(receipt));
        if (first && this.mode === 'lost-response') {
          this.db.prepare('INSERT INTO sim_hidden VALUES (?)').run(hash);
          throw Error('Respuesta perdida simulada');
        }
      },
      lookup: async hash => {
        if (this.db.prepare('DELETE FROM sim_hidden WHERE hash=?').run(hash).changes)
          throw Error('Primera consulta sin confirmación simulada');
        const row = this.db.prepare('SELECT receipt FROM simulated_receipts WHERE hash=?').get(hash);
        expect(row, 'Sin confirmación simulada');
        return JSON.parse(row.receipt);
      }
    };
    this.coordinator = new SettlementCoordinator(this.store,this.transport,clock);
  }
  close() { this.db.close(); this.store.close(); }
  latest() {
    const row = this.db.prepare('SELECT round_id,version FROM agreement_versions ORDER BY rowid DESC LIMIT 1').get();
    return row && this.store.getVersion(row.round_id,row.version);
  }
  freeze(input, previous) {
    calculateNetting(input);
    expect(input.accounts && input.consentBy > this.clock(), 'Direcciones y plazo requeridos');
    const latest = this.latest();
    expect((latest?.hash ?? null) === previous, 'Versión modificada');
    const open = this.db.prepare('SELECT id FROM rounds WHERE closed_at IS NULL').get();
    const newRound = !open || latest?.status === 'NET_ZERO';
    const id = newRound ? randomUUID() : open.id;
    const expectedVersion = latest?.agreement.roundId === id ? latest.agreement.version : null;
    return this.store.freezeVersion(id,expectedVersion,{...input,feeCapAtomic:'10000',consentScheme:'SEP-53'},newRound);
  }
  current(hash) {
    const view = this.latest();
    expect(view && view.hash === hash,'Versión no vigente');
    return view;
  }
  voteData(hash,actor,decision) {
    const v = this.current(hash);
    expect(v.agreement.accounts?.[actor.id] === actor.address && actor.round === v.agreement.roundId,'Sesión ajena');
    expect(['ACCEPT','REJECT'].includes(decision),'Decisión inválida');
    return {roundId:actor.round,version:v.agreement.version,agreementHash:hash,participantId:actor.id,decision};
  }
  message(hash,actor,decision) { return consentMessage(this.voteData(hash,actor,decision)).toString(); }
  vote(hash,actor,decision,signature) {
    this.store.recordSignedConsent({...this.voteData(hash,actor,decision),signature});
  }
  body(hash) { return this.db.prepare('SELECT * FROM web_bodies WHERE hash=?').get(hash); }
  prepare(hash) {
    const v = this.current(hash), a = v.agreement;
    if (this.body(hash)) return;
    const sequence = this.db.prepare('SELECT COUNT(*) AS n FROM simulated_receipts').get().n;
    const p = this.adapter.prepare({roundId:a.roundId,version:a.version,hash},String(sequence),'100');
    this.db.prepare('INSERT OR IGNORE INTO web_bodies VALUES (?,?,?,?)')
      .run(hash,JSON.stringify(p),p.unsignedXdr,'[]');
  }
  partial(hash,actor,xdr) {
    this.voteData(hash,actor,'ACCEPT');
    const b = this.body(hash);
    expect(b,'Preparar primero');
    const p = JSON.parse(b.prepared);
    const merged = this.adapter.mergePartial(p,b.envelope,xdr,actor.address);
    const signers = [...new Set([...JSON.parse(b.signers),actor.address])];
    const update = this.db.prepare('UPDATE web_bodies SET envelope=?,signers=? WHERE hash=? AND envelope=?')
      .run(merged,JSON.stringify(signers),hash,b.envelope);
    expect(update.changes,'Otro firmante actualizó el sobre; reintentar');

  }
  async settle(hash,action) {
    const v = this.current(hash), a = v.agreement;
    const attempt = this.store.findSettlementForVersion(a.roundId,a.version);
    if (action === 'lookup') return attempt && this.coordinator.reconcile(attempt.transactionHash);
    const b = this.body(hash);
    expect(b,'Preparar primero');
    const p = JSON.parse(b.prepared);
    if (action === 'submit') return this.coordinator.submit(p,b.envelope);
    expect(action === 'retry' && attempt,'Intento no disponible');
    const state = await this.coordinator.reconcile(attempt.transactionHash);
    if (state.state !== 'RECONCILING') return state;
    expect(state.detail === 'UNCONFIRMED','Evidencia discordante');
    const claim = this.db.prepare(`INSERT INTO web_retry VALUES (?,?) ON CONFLICT(hash)
      DO UPDATE SET until_ms=excluded.until_ms WHERE until_ms<=?`).run(attempt.transactionHash,this.clock()+30000,this.clock());
    expect(claim.changes,'Retransmisión en curso');
    const original = this.db.prepare('SELECT envelope_xdr FROM settlement_attempts WHERE transaction_hash=?').get(attempt.transactionHash);
    expect(this.clock() < attempt.maxTime*1000 && this.clock() < a.settleBy, 'Ventana de retransmisión vencida');
    expect(original.envelope_xdr === b.envelope, 'Sobre distinto al reservado');
    const tx = TransactionBuilder.fromXDR(original.envelope_xdr,Networks.TESTNET);
    expect(tx.hash().toString('hex') === attempt.transactionHash,'Hash discordante');
    try { await this.transport.submit(tx); } catch { /* outcome determined by lookup */ }
    return this.coordinator.reconcile(attempt.transactionHash);
  }
  state(actor) {
    const v = this.latest();
    if (!v) return {};
    const a = v.agreement, b = this.body(v.hash), p = b && JSON.parse(b.prepared);
    const body = p && TransactionBuilder.fromXDR(p.unsignedXdr,Networks.TESTNET);
    const sources = body ? new Set([body.source,...body.operations.map(op=>op.source ?? body.source)]) : new Set();
    const required = a.participants.filter(id=>sources.has(a.accounts[id]));
    const participant = actor?.kind === 'participant' && actor.round === a.roundId && a.accounts[actor.id] === actor.address;
    const votes = v.consents.map(({participantId,decision})=>({participantId,decision}));
    const attempt = this.store.findSettlementForVersion(a.roundId,a.version);
    return {agreement:a,hash:v.hash,status:v.status,votes,required,signers:b ? JSON.parse(b.signers) : [],
      transactionHash:p?.transactionHash,maxTime:p?.maxTime,
      unsignedXdr:participant && required.includes(actor.id) ? p?.unsignedXdr : undefined,attempt};
  }
}
