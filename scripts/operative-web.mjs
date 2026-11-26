import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Operative, expect } from './operative.mjs';
import { calculateNetting } from '../dist/netting.js';
import { verifySep53 } from '../dist/consents.js';

const token = () => randomBytes(32).toString('hex');
const files = new Map(Object.entries({
  '/':'web/operative.html','/ui.js':'web/ui.js','/style.css':'web/style.css',
  '/archivo.json':'doc/evidencia-t04/B01.json','/b05.json':'doc/evidencia-t05/B05.json',
  '/wallet.js':'node_modules/@stellar/varial-sdk/build/index.min.js','/fixture.json':'fixtures/cuatro-empresas.json'
}));
export function application(path, clock = Date.now, mode = 'success') {
  const service = new Operative(path,clock,mode), sessions = new Map(), challenges = new Map();
  let code = token();
  const initialCode = code;
  const server = http.createServer(async (req,res) => {
    const origin = 'http://127.0.0.1:'+server.address().port;
    const sid = /(?:^|; )cn=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
    const actor = sessions.get(sid);
    function json(value) { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(value ?? {})); }
    function login(data) {
      const key = token(); sessions.delete(sid);
      sessions.set(key,{...data,expires:clock()+3600000});
      res.setHeader('Set-Cookie','cn='+key+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600');
    }
    try {
      expect(req.headers.host === new URL(origin).host,'Origen inválido');
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      if (req.method === 'GET' && files.has(req.url)) {
        res.setHeader('Content-Type',({'/':'text/html; charset=utf-8','/style.css':'text/css','/fixture.json':'application/json','/archivo.json':'application/json','/b05.json':'application/json'})[req.url] ?? 'text/javascript');
        return res.end(await readFile(new URL('../'+files.get(req.url),import.meta.url)));
      }
      expect(req.method === 'POST' && req.headers.origin === origin && req.headers['content-type'] === 'application/json','Petición inválida');
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; expect(size <= 131072,'Petición demasiado grande'); chunks.push(chunk); }
      const b = JSON.parse(Buffer.concat(chunks).toString());
      const action = req.url.slice(1);
      if (action === 'admin') {
        expect(code && typeof b.code === 'string' && b.code.length === code.length &&
          /^[0-9a-f]+$/.test(b.code) && timingSafeEqual(Buffer.from(code),Buffer.from(b.code)),'Código inválido');
        code = null; login({kind:'coordinator'}); return json({});
      }
      if (action === 'challenge') {
        const v = service.latest();
        expect(v && Object.hasOwn(v.agreement.accounts,b.id) && v.agreement.accounts[b.id] === b.address,'Cuenta no asignada');
        const nonce = token(), expires = clock()+120000;
        const message = JSON.stringify({purpose:'cuynexo-session-v1',origin,round:v.agreement.roundId,
          versionHash:v.hash,participant:b.id,address:b.address,expires,nonce});
        for (const [key,c] of challenges) if (c.expires <= clock()) challenges.delete(key);
        expect(challenges.size < 1024,'Demasiados desafíos pendientes');
        challenges.set(nonce,{message,expires,id:b.id,address:b.address,round:v.agreement.roundId,hash:v.hash});
        return json({nonce,message});
      }
      if (action === 'login') {
        const c = challenges.get(b.nonce); challenges.delete(b.nonce);
        expect(c && clock()<c.expires && service.current(c.hash) &&
          verifySep53(c.address,Buffer.from(c.message),b.signature),'Desafío inválido');
        login({kind:'participant',id:c.id,address:c.address,round:c.round}); return json({});
      }
      expect(actor && clock()<actor.expires,'Se requiere sesión');
      if (action === 'logout') { sessions.delete(sid); return json({}); }
      if (actor.kind === 'participant') {
        const v = service.latest(); expect(v && v.agreement.roundId === actor.round &&
          v.agreement.accounts[actor.id] === actor.address,'Cuenta modificada');
      }
      if (action === 'state') return json({...service.state(actor),actor:actor.kind,id:actor.id,address:actor.address});
      if (action === 'lookup') { await service.settle(b.hash,'lookup'); return json({}); }
      if (actor.kind === 'coordinator') {
        if (action === 'calculate') return json(calculateNetting(b.input));
        if (action === 'freeze') service.freeze(b.input,b.previous);
        else if (action === 'prepare') service.prepare(b.hash);
        else if (['retry','submit'].includes(action)) await service.settle(b.hash,action);
        else throw Error('Acción no autorizada');
      } else if (action === 'message') return json({message:service.message(b.hash,actor,b.decision)});
      else if (action === 'vote') service.vote(b.hash,actor,b.decision,b.signature);
      else if (action === 'partial') service.partial(b.hash,actor,b.xdr);
      else throw Error('Acción no autorizada');
      json({});
    } catch(e) { res.statusCode = 400; json({error:e instanceof SyntaxError ? 'JSON inválido' : String(e.message).slice(0,200)}); }
  });
  server.on('close',()=>service.close());
  return {server,service,code:initialCode};
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.umask(0o077);
  const app = application(process.env.CUYNEXO_DB ?? 'cuynexo-web.sqlite', Date.now, process.env.CUYNEXO_SIM ?? 'success');
  app.server.listen(8765,'127.0.0.1',()=>console.log('Simulación local: http://127.0.0.1:8765/\nCódigo de coordinador (uso único): '+app.code));
}
