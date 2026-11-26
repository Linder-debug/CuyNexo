'use strict';
const el = id => document.getElementById(id);
const net = 'Test SDF Network ; September 2015';
let state = {};
async function api(action,body={}) {
  const r = await fetch('/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const value = await r.json();
  if (!r.ok) throw Error(value.error);
  return value;
}
function amount(value) {
  const digits = String(value).replace('-','').padStart(8,'0');
  return (String(value).startsWith('-')?'-':'')+(digits.slice(0,-7)+'.'+digits.slice(-7)).replace(/\.?0+$/,'');
}
function describe(a) {
  return ['Bruto '+amount(a.grossAtomic)+' XLM · Residual '+amount(a.residualAtomic)+' XLM',
    ...a.balances.map(x=>x.participantId+' '+amount(x.amountAtomic)+' XLM'),
    ...a.payments.map(x=>x.debtorId+' → '+x.creditorId+' '+amount(x.amountAtomic)+' XLM')].join('\n');
}
function draw() {
  const s=state,a=s.agreement, admin=s.actor==='coordinator', participant=s.actor==='participant';
  el('identity').textContent=admin?'Coordinador':participant?'Empresa '+s.id:'Sin sesión';
  el('editor').hidden=!admin;
  el('summary').textContent=a?[...a.obligations.map(x=>x.obligationId+' · '+x.debtorId+' → '+x.creditorId+' '+amount(x.amountAtomic)+' XLM'),describe(a)].join('\n'):'';
  el('agreement').textContent=a?['Ronda '+a.roundId+' · versión '+a.version+' · '+s.status,s.hash,
    'Consentir hasta '+new Date(a.consentBy).toLocaleString(),'Liquidar hasta '+new Date(a.settleBy).toLocaleString(),
    ...Object.entries(a.accounts).map(([id,address])=>id+' '+address+' · '+(s.votes.find(v=>v.participantId===id)?.decision??'pendiente'))].join('\n'):'Sin versión';
  const missing = (s.required??[]).filter(id=>!s.signers.includes(a.accounts[id]));
  el('auth').textContent=a?['Fuente global y comisión: '+a.transactionSourceId,'Firmas requeridas: '+(a.payments.length?s.required.join(', '):'ninguna'),
    'Faltan: '+(a.payments.length?missing.join(', ')||'ninguna':'ninguna'),s.transactionHash??'Cuerpo pendiente',
    s.maxTime?'Vence '+new Date(s.maxTime*1000).toLocaleString():''].join('\n'):'';
  const attempt=s.attempt, own=a?.balances.find(x=>x.participantId===s.id);
  let outcome=attempt?.state??s.status??'Sin intento';
  if(attempt) outcome+=' · '+attempt.transactionHash;
  if(attempt?.state==='RECONCILING') outcome+='\nVerificando en '+(s.transport==='testnet'?'Stellar testnet':'el simulador')+'. El resultado aún no se conoce.';
  if(own && BigInt(own.amountAtomic)>0n) outcome+='\n'+(attempt?.state==='FAILED'?'Recibido: 0':attempt?.state==='SETTLED'?'Recibido: '+amount(own.amountAtomic):'Por recibir: '+amount(own.amountAtomic))+' XLM';
  if(!attempt && own && BigInt(own.amountAtomic)>0n && s.transactionHash && missing.length) outcome+=' · Falta: '+missing.join(', ');
  const e=s.evidence, rows=e?.companies.filter(x=>admin||x.id===s.id)??[];
  const xlm = n=>n==null?'sin dato':amount(n)+' XLM';
  el('impact').textContent=rows.map(x=>x.id+' · paga '+xlm(x.pay)+' · recibe '+xlm(x.receive)+
    ' · comisión prevista: '+(x.plannedFeePayer?(e.plannedFeeAtomic?xlm(e.plannedFeeAtomic):'a su cargo; importe pendiente'):'0 XLM')).join('\n');
  el('verified').textContent=e?[
    ...rows.map(x=>x.id+' · pagado '+xlm(x.paid)+' · recibido '+xlm(x.received)+' · comisión cobrada '+xlm(x.feeAtomic)+
      '\nSaldo antes '+xlm(x.before?.amountAtomic)+' · después '+xlm(x.after?.amountAtomic)),
    'Comisión total cobrada: '+xlm(e.feeAtomic)+' · cuenta: '+(e.feeAccount??'sin dato'),
    'Ledger: '+(e.ledger??'sin dato')+' · envío a confirmación observada: '+(e.elapsedMs==null?'sin dato':e.elapsedMs+' ms'),
    ...(e.operations??[]).map(op=>op.index+'. '+op.source+' → '+op.destination+' · '+op.amountXlm+' XLM · '+(op.applied?'aplicada':'sin aplicar')),
    ...e.limits].join('\n'):'';
  for(const section of ['ob','ac','au','re']) {
    const heading=el(section).querySelector('h2');
    heading.dataset.origin=s.transport==='testnet'?'Testnet':s.transport==='simulation'?'Simulación':'';
  }
  el('cancel').disabled=!admin||!!attempt||!['PENDING_CONSENT','APPROVED'].includes(s.status);
  el('download').disabled=!e;
  el('result').textContent=outcome;
  el('prepare').disabled=!admin||s.status!=='APPROVED'||!!s.transactionHash;
  el('accept').disabled=el('reject').disabled=!participant||s.status!=='PENDING_CONSENT'||s.votes.some(v=>v.participantId===s.id);
  el('partial').disabled=!s.unsignedXdr||!missing.includes(s.id)||!!attempt;
  el('submit').disabled=s.status!=='APPROVED'||!admin||!s.transactionHash||missing.length>0||!!attempt;
  el('lookup').disabled=!attempt; el('retry').disabled=!admin||attempt?.detail!=='UNCONFIRMED';
}
async function refresh(){state=await api('state');draw();}
async function account() {
  if (!window.freighterApi) throw Error('Cliente Varial no disponible');
  const r=await freighterApi.requestAccess();
  if (r.error || !r.address) throw Error('Acceso cancelado o cuenta de Varial no disponible');
  const n=await freighterApi.getNetwork();
  if(n.error||n.networkPassphrase!==net) throw Error('Conecta la cuenta de prueba en Testnet');
  if(state.address && state.address!==r.address){await api('logout');state={};draw();throw Error('Cuenta modificada. Identifícate de nuevo');}
  return r.address;
}
async function signMessage(message,address) {
  const r=await freighterApi.signMessage(message,{address,networkPassphrase:net});
  if(r.error||r.signerAddress!==address)throw Error('Firma cancelada o cuenta incorrecta');
  return r.signedMessage;
}
function action(id,fn) {el(id).onclick=async()=>{try{el('notice').textContent='';await fn();}
  catch(e){el('notice').textContent=e.message;}};}
action('admin',async()=>{await api('admin',{code:el('code').value});el('code').value='';await refresh();});
action('logout',async()=>{await api('logout');state={};draw();});
action('login',async()=>{const address=await account(), id=el('company').value.trim();
  const c=await api('challenge',{id,address});
  await api('login',{nonce:c.nonce,signature:await signMessage(c.message,address)});await refresh();});
action('fixture',async()=>{const f=await(await fetch('/fixture.json')).json();el('input').value=JSON.stringify(f,null,2);
  el('accounts').value=JSON.stringify(Object.fromEntries(f.participants.map(id=>[id,''])),null,2);});
action('calculate',async()=>{el('summary').textContent=describe(await api('calculate',{input:JSON.parse(el('input').value)}));});
action('freeze',async()=>{await api('freeze',{previous:state.hash??null,input:{...JSON.parse(el('input').value),
  accounts:JSON.parse(el('accounts').value),transactionSourceId:el('source').value.trim(),
  consentBy:Date.now()+Number(el('minutes').value)*60000}});await refresh();});
for(const [id,decision] of [['accept','ACCEPT'],['reject','REJECT']]) action(id,async()=>{
  const hash=state.hash,address=await account(),{message}=await api('message',{hash,decision});
  await api('vote',{hash,decision,signature:await signMessage(message,address)});await refresh();});
action('partial',async()=>{const hash=state.hash,address=await account();
  const r=await freighterApi.signTransaction(state.unsignedXdr,{address,networkPassphrase:net});
  if(r.error||r.signerAddress!==address)throw Error('Firma cancelada o cuenta incorrecta');
  await api('partial',{hash,xdr:r.signedTxXdr});await refresh();});
for(const id of ['prepare','submit','lookup','retry'])action(id,async()=>{await api(id,{hash:state.hash});await refresh();});
action('refresh',refresh);draw();refresh().catch(()=>{});

action('cancel',async()=>{
  if(!window.confirm('¿Cancelar esta versión y bloquear sus firmas y envío?'))return;
  await api('cancel',{hash:state.hash});await refresh();
});
action('download',async()=>{
  const report=await api('export',{hash:state.hash});
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='CuyNexo-'+report.agreementHash+'.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
