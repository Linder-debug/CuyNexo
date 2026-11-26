import { Networks, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { verifyReceipt } from '../dist/settlement-coordinator.js';

export class RoundEvidence {
  constructor(service) {
    this.service = service;
    this.db = service.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS web_observations (
      hash TEXT PRIMARY KEY, sent INTEGER, confirmed INTEGER, before_json TEXT, after_json TEXT,
      details TEXT)`);
  }
  row(hash) { return this.db.prepare('SELECT * FROM web_observations WHERE hash=?').get(hash); }
  async snapshot(accounts) {
    const {transport,clock} = this.service;
    if (!transport.balance) return null;
    const entries = await Promise.all(Object.entries(accounts).map(async ([id,address]) => {
      try { return [id,{amountAtomic:await transport.balance(address), observedAt:clock()}]; }
      catch { return [id,null]; }
    }));
    return JSON.stringify(Object.fromEntries(entries));
  }
  agreement(attempt) {
    return this.service.store.inspectVersion(attempt.roundId,attempt.version).view.agreement;
  }
  markSent(hash,before=null) {
    this.db.prepare('INSERT OR IGNORE INTO web_observations(hash,sent,before_json) VALUES (?,?,?)')
      .run(hash,this.service.clock(),before);
  }
  async beforeSend(tx) {
    const hash = tx.hash().toString('hex');
    const attempt = this.service.store.getSettlementByHash(hash);
    if (this.row(hash)?.sent != null) return;
    const before = await this.snapshot(this.agreement(attempt).accounts);
    if (this.service.clock() >= attempt.maxTime*1000) throw Error('Cuerpo vencido');
    this.markSent(hash,before);
  }
  async observe(hash,receipt) {
    const attempt = this.service.store.getSettlementByHash(hash);
    const outcome = verifyReceipt(attempt,receipt);
    if (outcome.state === 'RECONCILING') return false;
    if (['FAILED','SETTLED'].includes(attempt.state) &&
      (outcome.state!==attempt.state || outcome.ledger!==attempt.ledger || outcome.feeAtomic!==attempt.feeAtomic)) return false;
    if (this.row(hash)?.details) return true;
    const tx = TransactionBuilder.fromXDR(receipt.envelope_xdr,Networks.TESTNET);
    const a = this.agreement(attempt);
    const confirmed = this.service.clock();
    const operations = tx.operations.map((op,index)=>({
      index:index+1,source:op.source ?? tx.source,destination:op.destination,
      amountXlm:op.amount,asset:'XLM',applied:receipt.successful
    }));
    const details = {operations,feeAccount:receipt.fee_account ?? tx.source,
      feeAccountOrigin:receipt.fee_account ? 'recibo' : 'fuente del sobre clásico verificado'};
    const after = await this.snapshot(a.accounts);
    this.db.prepare(`INSERT INTO web_observations(hash,confirmed,details,after_json) VALUES (?,?,?,?)
      ON CONFLICT(hash) DO UPDATE SET confirmed=excluded.confirmed,details=excluded.details,
      after_json=excluded.after_json WHERE web_observations.details IS NULL`)
      .run(hash,confirmed,JSON.stringify(details),after);
    return true;
  }
  report(view) {
    const {agreement:a,hash,status,consents} = view;
    const attempt = this.service.store.findSettlementForVersion(a.roundId,a.version);
    const b = this.service.body(hash);
    const prepared = b && JSON.parse(b.prepared);
    const row = attempt && this.row(attempt.transactionHash);
    const details = JSON.parse(row?.details ?? 'null');
    const final = ['SETTLED','FAILED'].includes(attempt?.state);
    const elapsed = row?.confirmed != null && row.sent != null && row.confirmed>=row.sent ? row.confirmed-row.sent : null;
    const before = JSON.parse(row?.before_json ?? 'null'), after = JSON.parse(row?.after_json ?? 'null');
    const feeAccount = details?.feeAccount ?? null;
    const companies = a.participants.map(id=>{
      const sum = field => a.payments.filter(p=>p[field]===id).reduce((v,p)=>v+BigInt(p.amountAtomic),0n).toString();
      const pay=sum('debtorId'),receive=sum('creditorId');
      return {id,address:a.accounts[id],pay,receive,plannedFeePayer:id===a.transactionSourceId,
        paid:final ? (attempt.state==='SETTLED'?pay:'0') : null,
        received:final ? (attempt.state==='SETTLED'?receive:'0') : null,
        feeAtomic:feeAccount ? (feeAccount===a.accounts[id]?attempt.feeAtomic:'0') : null,
        before:before?.[id]??null,after:after?.[id]??null};
    });
    return {schemaVersion:1,origin:this.service.mode==='testnet'?'testnet':'simulación',agreement:a,agreementHash:hash,status,
      decisions:consents.map(({participantId,decision,receivedAt})=>({participantId,decision,receivedAt})),
      signers:b?JSON.parse(b.signers):[],companies,transactionHash:attempt?.transactionHash??prepared?.transactionHash??null,
      plannedFeeAtomic:prepared ? String(TransactionBuilder.fromXDR(prepared.unsignedXdr,Networks.TESTNET).fee) : null,
      result:attempt?.state??null,ledger:attempt?.ledger??null,feeAtomic:attempt?.feeAtomic??null,
      feeAccount,feeAccountOrigin:details?.feeAccountOrigin??null,operations:details?.operations??null,
      sentAt:row?.sent??null,confirmationObservedAt:row?.confirmed??null,elapsedMs:elapsed,
      limits:['null indica dato no disponible.','Los saldos son lecturas alrededor del envío y la verificación; pueden incluir actividad ajena.',
        'El tiempo termina en la observación local del recibo por hash y puede incluir reinicios o demoras de consulta.']};
  }
}
