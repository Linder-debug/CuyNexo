
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const req=createRequire(process.cwd()+'/package.json');
const browserRequire=createRequire(resolve(process.env.CUYNEXO_BROWSER_TOOLS,'package.json'));
const {default:puppeteer}=await import(browserRequire.resolve('puppeteer-core'));
const {default:chromium}=await import(browserRequire.resolve('@sparticuz/chromium'));
const {Keypair,Networks,TransactionBuilder}=req('@stellar/stellar-sdk/base');
const {application}=await import(process.cwd()+'/scripts/operative-web.mjs');
const dir=mkdtempSync(join(tmpdir(),'cuy-browser-'));
const app=application(join(dir,'test.sqlite'),Date.now, 'lost-response');
await new Promise(ok=>app.server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+app.server.address().port;
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>!a.includes('disable-web-security')),headless:true});
try {
  async function page(){
    const ctx=await browser.createBrowserContext(), p=await ctx.newPage();
    await p.goto(origin,{waitUntil:'networkidle2'});p.setDefaultTimeout(5000);
    return p;
  }
  const admin=await page();
  async function click(p,id,condition){
    await p.click('#'+id); if(condition) try{await p.waitForFunction(condition,{timeout:5000});}catch(e){ console.log(id,await p.$eval('#notice',e=>e.textContent));throw e;}
  }
  const keys=Object.fromEntries('ABCD'.split('').map(id=>[id,Keypair.random()]));
  await admin.type('#code',app.code);await click(admin,'admin',"!document.querySelector('#editor').hidden");
  await click(admin,'fixture',"document.querySelector('#input').value.includes('O1')");
  await admin.$eval('#accounts',(e,x)=>e.value=x,JSON.stringify(Object.fromEntries(Object.entries(keys).map(([id,k])=>[id,k.publicKey()]))));
  await click(admin,'calculate',"document.querySelector('#summary').textContent.includes('320')");
  await click(admin,'freeze',"document.querySelector('#agreement').textContent.includes('PENDING_CONSENT')");
  const pages={};
  for(const [id,k] of Object.entries(keys)){
    const p=pages[id]=await page();
    await p.exposeFunction('testSignMessage',m=>k.sign(createHash('sha256').update('Stellar Signed Message:\n').update(m).digest()).toString('base64'));
    await p.exposeFunction('testSignTx',x=>{const tx=TransactionBuilder.fromXDR(x,Networks.TESTNET);tx.sign(k);return tx.toXDR()});
    await p.evaluate(address=>{window.freighterApi={requestAccess:async()=>({address}),getNetwork:async()=>({networkPassphrase:'Test SDF Network ; September 2015'}),
      signMessage:async m=>({signerAddress:address,signedMessage:await window.testSignMessage(m)}),
      signTransaction:async x=>({signerAddress:address,signedTxXdr:await window.testSignTx(x)})};},k.publicKey());
    await p.type('#company',id);await click(p,'login',"document.querySelector('#identity').textContent.startsWith('Empresa')");
    await click(p,'accept',"document.querySelector('#accept').disabled");
  }
  await click(admin,'refresh',"!document.querySelector('#prepare').disabled");
  await click(admin,'prepare',"document.querySelector('#auth').textContent.includes('Vence')");
  for(const id of ['A','B']){await click(pages[id],'refresh',"!document.querySelector('#partial').disabled");await click(pages[id],'partial',"document.querySelector('#partial').disabled");}
  await click(admin,'refresh',"!document.querySelector('#submit').disabled");await click(admin,'submit',"document.querySelector('#result').textContent.includes('RECONCILING')");
  await click(pages.C,'refresh',"!document.querySelector('#lookup').disabled");
  await click(pages.C,'lookup',"document.querySelector('#result').textContent.includes('Recibido: 20 XLM')");
  console.log('PASS Chromium: 5 sesiones, 4 consentimientos, 2 firmas, respuesta perdida y recuperación de C. Wallet de prueba.');
} finally {await browser.close();await new Promise(done=>app.server.close(done));rmSync(dir,{recursive:true,force:true});}
