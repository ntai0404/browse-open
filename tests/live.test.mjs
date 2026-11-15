import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('../scripts/browse-open.mjs',import.meta.url));
const root=process.env.CHROMIUM_OPEN_ROOT;
const executable=process.env.CHROMIUM_OPEN_EXE;
function run(args) {return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{windowsHide:true});let out='',err='';
  child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.once('error',reject);
  child.once('exit',code=>{try{const value=JSON.parse(out);assert.equal(code,0,JSON.stringify(value));resolve(value);}catch(e){reject(new Error(`${e.message}\n${err}`));}});
});}
test('LIVE: open existing selected profile, reconnect after CLI exit, verify DOM/window, preserve browser', {skip:!root||!executable,timeout:120000}, async t=>{
  const marker='ChromiumOpenProof-'+Date.now();
  let hits=0;
  const server=http.createServer((req,res)=>{if(req.url==='/proof')hits++;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><title>${marker}</title></head><body><h1>${marker}</h1></body></html>`);});
  const sockets=new Set();server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(resolve=>{server.close(resolve);for(const socket of sockets)socket.destroy();}));
  const url=`http://127.0.0.1:${server.address().port}/proof`;
  const selection=['--user-data-dir',root,'--profile-directory',process.env.CHROMIUM_OPEN_PROFILE||'Default','--browser','chromium','--executable',executable,'--timeout','45000'];
  const listed=await run(['profiles','--user-data-dir',root]);
  assert.ok(listed.data.profiles.some(p=>p.profileDirectory===(process.env.CHROMIUM_OPEN_PROFILE||'Default')&&p.exists));
  const opened=await run(['open',...selection,'--url',url,'--expect-title',marker]);
  assert.equal(opened.data.page.title,marker);assert.equal(opened.data.page.verified,true);assert.ok(opened.data.instance.handle>0);assert.ok(hits>0);
  const identity=['--instance',String(opened.data.instance.pid),'--endpoint',opened.data.endpoint];
  const connected=await run(['connect',...selection,...identity]);assert.equal(connected.data.reused,true);assert.equal(connected.data.instance.pid,opened.data.instance.pid);
  const tabs=await run(['tabs',...selection,...identity]);assert.ok(tabs.data.tabs.some(p=>p.targetId===opened.data.page.targetId&&p.url===url));
  const verified=await run(['verify',...selection,...identity,'--target',opened.data.page.targetId,'--url',url,'--expect-title',marker]);
  assert.equal(verified.data.page.title,marker);assert.equal(verified.data.instance.pid,opened.data.instance.pid);
  // Independent HTTP CDP listing and local HTTP server hit counter supplement harness assertions.
  const targets=await (await fetch(opened.data.endpoint+'/json/list')).json();
  assert.ok(targets.some(p=>p.id===opened.data.page.targetId&&p.title===marker&&p.url===url));
  const report={status:'PASS',opened,connected:connected.data.instance,tabs:tabs.data.tabs,verified:verified.data,independent:{httpHits:hits,targetPresent:true},browserPreserved:true,userVisualConfirmation:'NOT_TESTED'};
  if(process.env.CHROMIUM_OPEN_EVIDENCE)fs.writeFileSync(process.env.CHROMIUM_OPEN_EVIDENCE,JSON.stringify(report,null,2));
  console.log('LIVE_EVIDENCE '+JSON.stringify({pid:opened.data.instance.pid,reused:opened.data.reused,endpoint:opened.data.endpoint,target:opened.data.page.targetId,marker,httpHits:hits}));
});
