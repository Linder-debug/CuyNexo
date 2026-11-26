import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { NotFoundError } from '@stellar/stellar-sdk';
import { application } from '../scripts/operative-web.mjs';
import { Operative } from '../scripts/operative.mjs';

const fixture=JSON.parse(readFileSync(new URL('../fixtures/cuatro-empresas.json',import.meta.url)));
const sign=(key,text)=>key.sign(createHash('sha256').update('Stellar Signed Message:\n').update(text).digest()).toString('base64');
function lab(t,input=fixture,mode='success',createServer) {
  const dir=mkdtempSync(join(tmpdir(),'cuynexo-test-')), path=join(dir,'lab.sqlite');
  const keys=Object.fromEntries(input.participants.map(id=>[id,Keypair.random()]));
  const accounts=Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,v.publicKey()]));
  const l={now:Date.now(),path,keys,accounts};
  l.s=new Operative(path,()=>l.now,mode,createServer);
  const draft={...input,accounts,consentBy:l.now+10000,transactionSourceId:input.participants[0]};
  l.view=l.s.freeze(draft,null);
  l.actor=id=>({kind:'participant',id,address:accounts[id],round:l.view.agreement.roundId});
  l.vote=(id,decision='ACCEPT')=>{
    const actor=l.actor(id), hash=l.view.hash;
    l.s.vote(hash,actor,decision,sign(keys[id],l.s.message(hash,actor,decision)));
  };
  l.prepare=()=>{for(const id of input.participants)l.vote(id);l.s.prepare(l.view.hash);};
  l.partial=(id,as=id)=>{
    const p=JSON.parse(l.s.body(l.view.hash).prepared);
    const tx=TransactionBuilder.fromXDR(p.unsignedXdr,Networks.TESTNET);
    tx.sign(keys[as]);l.s.partial(l.view.hash,l.actor(id),tx.toXDR());
  };
  l.restart=()=>{l.s.close();l.s=new Operative(path,()=>l.now,mode,createServer);};
  t.after(()=>{l.s.close();rmSync(dir,{recursive:true,force:true});});
  return l;
}
test('P0: SEP-53 persistido, vigencia y parciales tras reiniciar',async t=>{
  const l=lab(t);l.prepare();l.partial('A');
  const before=l.s.body(l.view.hash);
  await assert.rejects(l.s.settle(l.view.hash,'submit'));
  l.restart();l.now+=12000;
  assert.deepEqual(l.s.body(l.view.hash),before);
  assert.throws(()=>l.partial('B','A'));
  l.partial('B');
  const results=await Promise.all([l.s.settle(l.view.hash,'submit'),l.s.settle(l.view.hash,'submit')]);
  assert.ok(results.every(x=>x.state==='SETTLED'));
  assert.equal(l.s.db.prepare('SELECT count(*) n FROM simulated_calls').get().n,1);
});
test('P0: consentimiento rechazado, sintético y firma ajena bloqueados',t=>{
  const l=lab(t), hash=l.view.hash;
  assert.throws(()=>l.s.store.recordConsent(l.s.voteData(hash,l.actor('A'),'ACCEPT')));
  assert.throws(()=>l.s.vote(hash,l.actor('A'),'ACCEPT',sign(l.keys.B,l.s.message(hash,l.actor('A'),'ACCEPT'))));
  l.vote('C','REJECT');
  assert.equal(l.s.latest().status,'REJECTED');
  assert.throws(()=>l.s.prepare(hash));
});
test('P0: vuelve a verificar SEP-53 al preparar después de reabrir SQLite',t=>{
  const l=lab(t);for (const id of fixture.participants) l.vote(id);
  l.s.db.prepare("UPDATE signed_consent_proofs SET signature='invalid' WHERE participant_id='A'").run();
  l.restart();assert.throws(()=>l.s.prepare(l.view.hash));
});
test('P0: maxTime impide completar parciales vencidos',t=>{
  const l=lab(t);l.prepare();l.partial('A');l.now+=300001;
  assert.throws(()=>l.partial('B'));assert.equal(l.s.state().attempt,undefined);
});
test('P0: conjunto alternativo y fuente global sin operación propia',t=>{
  const l=lab(t,{participants:['X','Y','Z'],obligations:[{obligationId:'o',debtorId:'Z',creditorId:'Y',amountAtomic:'100'}]});
  l.prepare();assert.deepEqual(l.s.state().required,['X','Z']);assert.throws(()=>l.partial('Y'));
});
test('P0: 8 empresas, neto cero y ausencia de intento',t=>{
  const participants='ABCDEFGH'.split('');const l=lab(t,{participants,obligations:[]});
  participants.forEach(id=>l.vote(id));assert.equal(l.s.latest().status,'NET_ZERO');
  assert.throws(()=>l.s.prepare(l.view.hash));assert.equal(l.s.state().attempt,undefined);
});
test('P0: reserva sin llamada, consulta pasiva y retransmisión idéntica',async t=>{
  const l=lab(t);l.prepare();l.partial('A');l.partial('B');
  const b=l.s.body(l.view.hash),p=JSON.parse(b.prepared),tx=l.s.adapter.requireReady(p,b.envelope);
  l.s.store.reserveSettlement({roundId:p.agreement.roundId,version:p.agreement.version,agreementHash:l.view.hash,
    transactionHash:p.transactionHash,envelopeXdr:b.envelope,operationCount:tx.operations.length,maxTime:p.maxTime});
  l.restart();assert.equal((await l.s.settle(l.view.hash,'lookup')).state,'RECONCILING');
  assert.equal(l.s.db.prepare('SELECT count(*) n FROM simulated_calls').get().n,0);
  const tries=await Promise.allSettled([l.s.settle(l.view.hash,'retry'),l.s.settle(l.view.hash,'retry')]);assert.ok(tries.some(x=>x.status==='fulfilled'),tries.map(x=>x.reason?.message).join(', '));
  assert.equal((await l.s.settle(l.view.hash,'lookup')).state,'SETTLED');
  assert.equal(l.s.db.prepare('SELECT count(*) n FROM simulated_calls').get().n,1);
  assert.equal((await l.s.transport.lookup(p.transactionHash)).envelope_xdr,b.envelope);
});
test('P0: respuesta perdida, conciliación sin reenvío tras reinicio',async t=>{
  const l=lab(t);l.prepare();l.partial('A');l.partial('B');
  const send=l.s.transport.submit;
  l.s.transport.submit=async tx=>{await send(tx);throw Error('respuesta perdida');};
  l.s.transport.lookup=async()=>{throw Error('sondeo indisponible');};
  assert.equal((await l.s.settle(l.view.hash,'submit')).state,'RECONCILING');
  l.restart();assert.equal((await l.s.settle(l.view.hash,'retry')).state,'SETTLED');
  assert.equal(l.s.db.prepare('SELECT count(*) n FROM simulated_calls').get().n,1);
});
test('P0 HTTP: origen, coordinador, desafío único, roles y revocación',async t=>{
  const l=lab(t),app=application(l.path,()=>l.now);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>app.server.close(resolve)));
  const origin='http://127.0.0.1:'+app.server.address().port;
  const post=(name,data,cookie='',site=origin)=>fetch(origin+'/'+name,{method:'POST',
    headers:{origin:site,'Content-Type':'application/json',cookie},body:JSON.stringify(data)});
  const cookie=r=>r.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('admin',{code:app.code},'','http://otro')).status,400);
  const admin=cookie(await post('admin',{code:app.code}));
  assert.equal((await post('admin',{code:app.code})).status,400);
  assert.equal((await post('vote',{},admin)).status,400);
  const {message,nonce}=await(await post('challenge',{id:'A',address:l.accounts.A})).json();
  const proof={nonce,signature:sign(l.keys.A,message)};
  const a=cookie(await post('login',proof));assert.equal((await post('login',proof)).status,400);
  assert.equal((await post('submit',{hash:l.view.hash},a)).status,400);
  assert.equal((await post('vote',{decision:'ACCEPT',signature:proof.signature,hash:l.view.hash},a)).status,400);
  assert.equal((await post('state',{},a)).status,200);
  await post('logout',{},a);assert.equal((await post('state',{},a)).status,400);
});
test('P0 HTTP: recorrido integrado completo con cuatro clientes y transporte simulado',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cuynexo-http-'));
  const app=application(join(dir,'db'),Date.now,'lost-response');
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));rmSync(dir,{recursive:true,force:true});});
  const origin='http://127.0.0.1:'+app.server.address().port;
  const client=()=>{
    let cookie='';
    return async(name,data={})=>{
      const r=await fetch(origin+'/'+name,{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
      const result=await r.json();assert.equal(r.status,200,result.error);return result;
    };
  };
  for(const file of ['/','/ui.js','/wallet.js','/fixture.json','/style.css'])
    assert.equal((await fetch(origin+file)).status,200);
  const admin=client(), keys={},accounts={},users={};
  await admin('admin',{code:app.code});
  for(const id of fixture.participants){keys[id]=Keypair.random();accounts[id]=keys[id].publicKey();users[id]=client();}
  const net=await admin('calculate',{input:fixture});assert.equal(net.grossAtomic,'3200000000');
  await admin('freeze',{previous:null,input:{...fixture,accounts,transactionSourceId:'A',consentBy:Date.now()+60000}});
  const {hash}=await admin('state');
  for(const id of fixture.participants){
    const user=users[id];
    const challenge=await user('challenge',{id,address:accounts[id]});
    await user('login',{nonce:challenge.nonce,signature:sign(keys[id],challenge.message)});
    const {message}=await user('message',{hash,decision:'ACCEPT'});
    await user('vote',{hash,decision:'ACCEPT',signature:sign(keys[id],message)});
  }
  await admin('prepare',{hash});
  for(const id of ['A','B']){
    const st=await users[id]('state'),tx=TransactionBuilder.fromXDR(st.unsignedXdr,Networks.TESTNET);
    tx.sign(keys[id]);await users[id]('partial',{hash,xdr:tx.toXDR()});
  }
  await admin('submit',{hash});
  assert.equal((await users.C('state')).attempt.state,'RECONCILING');
  await users.C('lookup',{hash});
  assert.equal((await users.C('state')).attempt.state,'SETTLED');
});
test('P0: una ronda inválida conserva la versión, sustitución y rechazo de voto tardío',t=>{
  const l=lab(t), actor=l.actor('C'), old=l.s.message(l.view.hash,actor,'ACCEPT');
  const draft={...fixture,accounts:l.accounts,transactionSourceId:'A',consentBy:l.now+10000};
  assert.throws(()=>l.s.freeze({...draft,accounts:{...l.accounts,C:l.accounts.A}},l.view.hash));
  assert.equal(l.s.latest().hash,l.view.hash);
  const next=l.s.freeze(draft,l.view.hash);
  assert.throws(()=>l.s.vote(next.hash,actor,'ACCEPT',sign(l.keys.C,old)));
  assert.throws(()=>l.s.vote(l.view.hash,actor,'ACCEPT',sign(l.keys.C,old)));
  const message=l.s.message(next.hash,actor,'ACCEPT');l.now+=10000;
  assert.throws(()=>l.s.vote(next.hash,actor,'ACCEPT',sign(l.keys.C,message)));
});
test('P0: fallo simulado no aplica pagos y un intento discordante no se retransmite',async t=>{
  const l=lab(t);l.prepare();l.partial('A');l.partial('B');l.s.mode='failure';
  const lookup=l.s.transport.lookup;
  l.s.transport.lookup=async hash=>({...await lookup(hash),hash:'00'.repeat(32)});
  assert.equal((await l.s.settle(l.view.hash,'submit')).detail,'LEDGER_MISMATCH');
  await assert.rejects(l.s.settle(l.view.hash,'retry'));
  assert.throws(()=>l.s.freeze({...fixture,accounts:l.accounts,transactionSourceId:'A',consentBy:l.now+60000},l.view.hash));
  l.s.transport.lookup=lookup;
  assert.equal((await l.s.settle(l.view.hash,'lookup')).state,'FAILED');
  assert.equal(l.s.db.prepare('SELECT count(*) n FROM settled_obligations').get().n,0);
});

test('Web testnet: inicio pasivo, secuencia y comisión externas, recuperación exacta sin tráfico externo',async t=>{
  let clients=0, queries=0, tx, lookupError=Error('Horizon indisponible'), address;
  const calls=[];
  const server={
    async loadAccount(id){address=id; return {sequenceNumber:()=>'98765432100000000'};},
    async fetchBaseFee(){return 120;},
    async submitTransaction(value){tx=value; calls.push(value.toXDR()); throw Error('respuesta perdida');},
    transactions(){return {transaction:hash=>({call:async()=>{
      queries++;
      assert.equal(hash,tx.hash().toString('hex'));
      if(lookupError)throw lookupError;
      return {hash,successful:true,envelope_xdr:tx.toXDR(),operation_count:3,ledger_attr:123,fee_charged:'360'};
    }})};}
  };
  const l=lab(t,fixture,'testnet',()=>{clients++;return server;});
  assert.equal(clients,0);
  assert.throws(()=>new Operative(l.path),/diario exclusivo/);
  assert.throws(()=>l.s.prepare(l.view.hash));
  for(const id of fixture.participants)l.vote(id);
  assert.equal(clients,0);
  await l.s.prepare(l.view.hash);
  const frozen=JSON.parse(l.s.body(l.view.hash).prepared);
  const payable=TransactionBuilder.fromXDR(frozen.unsignedXdr,Networks.TESTNET);
  assert.equal(address,l.accounts.A);
  assert.equal(payable.sequence,'98765432100000001');
  assert.equal(payable.fee,'360');
  l.partial('A');l.restart();l.partial('B');
  assert.equal((await l.s.settle(l.view.hash,'submit')).state,'RECONCILING');
  l.restart();
  assert.equal((await l.s.settle(l.view.hash,'lookup')).state,'RECONCILING');
  await assert.rejects(l.s.settle(l.view.hash,'retry'),/inconclusa/);
  assert.equal(calls.length,1);
  lookupError=new NotFoundError('Not found',{status:404});
  await l.s.settle(l.view.hash,'retry');
  assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);
  lookupError=null;
  assert.equal((await l.s.settle(l.view.hash,'lookup')).state,'SETTLED');
  assert.equal(calls.length,2);assert.ok(queries>=5);
});

test('Web testnet: una BD de simulación y una comisión fuera del límite bloquean la preparación',async t=>{
  const sim=lab(t);
  assert.throws(()=>new Operative(sim.path,Date.now,'testnet'),/diario exclusivo/);
  const l=lab(t,fixture,'testnet',()=>({
    loadAccount:async()=>({sequenceNumber:()=>'42'}),fetchBaseFee:async()=>999999
  }));
  fixture.participants.forEach(id=>l.vote(id));
  await assert.rejects(l.s.prepare(l.view.hash));
  assert.equal(l.s.body(l.view.hash),undefined);
});

test('Web testnet: la portada identifica el modo sin inicializar Horizon',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cuynexo-mode-'));
  let clients=0;
  const app=application(join(dir,'db'),Date.now,'testnet',()=>{clients++;throw Error('Acceso inesperado');});
  await new Promise(ok=>app.server.listen(0,'127.0.0.1',ok));
  t.after(async()=>{await new Promise(ok=>app.server.close(ok));rmSync(dir,{recursive:true,force:true});});
  const page=await (await fetch('http://127.0.0.1:'+app.server.address().port)).text();
  assert.match(page,/Stellar TESTNET/);
  assert.match(page,/Enviar a Stellar testnet/);
  assert.doesNotMatch(page,/Enviar al simulador/);
  assert.equal(clients,0);
});
