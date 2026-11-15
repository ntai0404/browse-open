import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Failure,flag,profile,profiles,endpoint,perform,connect,normalizeInventory,httpJson,openUrl} from '../scripts/core.mjs';
const cli=fileURLToPath(new URL('../scripts/chromium-open.mjs',import.meta.url));
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'chromium-open-unit-'));
  fs.mkdirSync(path.join(root,'Profile 1'));fs.writeFileSync(path.join(root,'Profile 1','Preferences'),'{}');
  fs.writeFileSync(path.join(root,'Local State'),JSON.stringify({profile:{info_cache:{'Profile 1':{name:'Visible name is not directory'}}}}));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
function instance(root,extra={}) {return {pid:77,executable:'C:\\ms-playwright\\chromium-1\\chrome-win64\\chrome.exe',commandLine:`chrome.exe "--user-data-dir=${root}" "--profile-directory=Profile 1" --remote-debugging-port=9555`,handle:123,title:'Unit boundary fixture',sessionId:1,...extra};}
function adapter(rows=[]) {return {effects:{},inventory:async()=>({processes:rows,listeners:[],os:'unit fixture'}),launch:async()=>{throw Error('Unexpected launch: safety guard failed');}};}
const options=root=>({'user-data-dir':root,'profile-directory':'Profile 1'});
async function code(promise,expected){await assert.rejects(promise,e=>e instanceof Failure&&e.code===expected);}

test('parse both Windows quoting forms without confusing profile name',()=>{
  assert.equal(flag('chrome.exe "--user-data-dir=C:\\path with spaces"','user-data-dir'),'C:\\path with spaces');
  assert.equal(flag('chrome.exe --profile-directory="Profile 1"','profile-directory'),'Profile 1');
});
test('profile list uses directory identity, not display name',t=>{
  const root=fixture(t),listed=profiles(root);
  assert.equal(listed[0].profileDirectory,'Profile 1');assert.equal(listed[0].displayName,'Visible name is not directory');
  assert.equal(profile(root,'Profile 1').profileDirectory,'Profile 1');
  fs.mkdirSync(path.join(root,'System Profile'));fs.writeFileSync(path.join(root,'System Profile','Preferences'),'{}');
  assert.equal(profiles(root).some(p=>p.profileDirectory==='System Profile'),false);
  assert.throws(()=>profile(root,'System Profile'),e=>e.code==='PROFILE_UNSUPPORTED');
  assert.throws(()=>profile(root,'Visible name is not directory'),e=>e.code==='PROFILE_NOT_FOUND');
});
test('missing root/profile and traversal never create directories',t=>{
  const root=fixture(t),missing=path.join(root,'absent');
  assert.throws(()=>profile(missing,'Default'),e=>e.code==='PROFILE_NOT_FOUND');
  assert.throws(()=>profile(root,'Default'),e=>e.code==='PROFILE_NOT_FOUND');
  assert.throws(()=>profile(root,'../Profile 1'),e=>e.code==='INVALID_PROFILE_DIRECTORY');
  assert.equal(fs.existsSync(missing),false);assert.equal(fs.existsSync(path.join(root,'Default')),false);
});
test('invalid URL fails before inspecting/launching browser',async()=>{
  await code(perform('open',{url:'file:///C:/secret'}, {effects:{},inventory:()=>{throw Error('Must not inspect');}}, Date.now()+1000),'INVALID_URL');
});
test('browser executable missing is explicit and never launches',async t=>{
  const root=fixture(t),a=adapter();
  await code(perform('open',{...options(root),url:'https://example.com/',executable:path.join(root,'missing.exe')},a,Date.now()+5000),'BROWSER_NOT_FOUND');
  assert.deepEqual(a.effects,{});
});
test('running selected profile without endpoint is blocked, never restarted',async t=>{
  const root=fixture(t),a=adapter([instance(root,{commandLine:`chrome.exe "--user-data-dir=${root}" "--profile-directory=Profile 1" --remote-debugging-pipe`})]);
  await code(perform('open',{...options(root),url:'https://example.com/'},a,Date.now()+5000),'INSTANCE_NOT_CONNECTABLE');assert.deepEqual(a.effects,{});
});
test('wrong selected profile does not contact CDP',async t=>{
  const root=fixture(t),inv=normalizeInventory({processes:[instance(root)],listeners:[]});
  await code(connect(inv,{userDataDir:root,profileDirectory:'Other'},{},()=>1000),'PROFILE_UNVERIFIED');
});
test('foreign TCP owner is refused before network access',async t=>{
  const root=fixture(t),inv=normalizeInventory({processes:[instance(root)],listeners:[{pid:88,address:'127.0.0.1',port:9555}]});
  await code(connect(inv,{userDataDir:root,profileDirectory:'Profile 1'},{},()=>1000),'ENDPOINT_OWNER_MISMATCH');
});
test('loopback restriction rejects credentials, remote hosts and path tricks',()=>{
  for(const s of ['https://127.0.0.1:9555','http://evil.example:9555','http://user:pass@127.0.0.1:9555','http://127.0.0.1:9555/foo'])assert.throws(()=>endpoint(s),e=>e.code==='INVALID_ENDPOINT');
  assert.equal(endpoint('http://localhost:9555'),'http://127.0.0.1:9555');
});
test('real TCP connection refusal is a connection failure (no browser simulated)',async t=>{
  const root=fixture(t);
  const net=await import('node:net');const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
  const inv=normalizeInventory({processes:[instance(root,{commandLine:`chrome.exe "--user-data-dir=${root}" "--profile-directory=Profile 1" --remote-debugging-port=${port}`})],listeners:[{pid:77,address:'127.0.0.1',port}]});
  await code(connect(inv,{userDataDir:root,profileDirectory:'Profile 1'},{},()=>1000),'CONNECTION_FAILED');
});
test('reuse routing preserves an existing process; mocked CDP boundary is unit evidence only',async t=>{
  const root=fixture(t),row=instance(root),a=adapter([row]);let disconnected=false;
  a.connect=async()=>({instance:normalizeInventory({processes:[row]}).processes[0],address:'http://127.0.0.1:9555',cdp:{call:async m=>{assert.equal(m,'Target.getTargets');return {targetInfos:[{type:'page',targetId:'fixture',url:'https://example.com/',title:'fixture'}]};},disconnect:()=>{disconnected=true;}}});
  const r=await perform('tabs',options(root),a,Date.now()+5000);assert.equal(r.reused,true);assert.equal(r.tabs[0].targetId,'fixture');assert.equal(disconnected,true);assert.deepEqual(a.effects,{});
});
test('CLI invalid command has one JSON object and stable exit code',()=>{
  const r=spawnSync(process.execPath,[cli,'close'],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).error.code,'INVALID_COMMAND');assert.equal(r.stdout.trim().split('\n').length,1);
});
test('CLI missing profile is a structured BLOCKED result',()=>{
  const r=spawnSync(process.execPath,[cli,'profiles','--user-data-dir',path.join(os.tmpdir(),'chromium-open-does-not-exist')],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,3);assert.equal(JSON.parse(r.stdout).status,'BLOCKED');assert.equal(JSON.parse(r.stdout).error.code,'PROFILE_NOT_FOUND');
});

test('open reuses a healthy running instance at mocked CDP boundary, never launches',async t=>{
  const root=fixture(t),row=instance(root),a=adapter([row]);let disconnected=false;
  const calls=[];
  a.connect=async()=>({instance:normalizeInventory({processes:[row]}).processes[0],address:'http://127.0.0.1:9555',cdp:{call:async(method,params)=>{
    calls.push(method);
    if(method==='Target.createTarget')return {targetId:'unit-created'};
    if(method==='Target.attachToTarget')return {sessionId:'unit-session'};
    if(method==='Runtime.evaluate')return {result:{value:JSON.stringify({url:'https://example.com/',title:'fixture',readyState:'complete',bodyPresent:true,bodyTextLength:7})}};
    if(method==='Target.getTargetInfo')return {targetInfo:{type:'page',url:'https://example.com/'}};
    if(method==='Target.detachFromTarget')return {};
    throw Error('Unexpected CDP command '+method);
  },disconnect:()=>{disconnected=true;}}});
  const r=await perform('open',{...options(root),url:'https://example.com/'},a,Date.now()+5000);
  assert.equal(r.reused,true);assert.equal(r.page.targetId,'unit-created');assert.deepEqual(a.effects,{tabCreatedId:'unit-created'});assert.ok(calls.includes('Runtime.evaluate'));assert.equal(disconnected,true);
});
test('real HTTP timeout is bounded and has a TIMEOUT code',async t=>{
  const http=await import('node:http');const server=http.createServer(()=>{});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const start=Date.now();
  await code(httpJson(`http://127.0.0.1:${server.address().port}/json/version`,()=>100),'TIMEOUT');
  assert.ok(Date.now()-start<2000);
});
test('CLI refuses options irrelevant to the selected command',()=>{
  const r=spawnSync(process.execPath,[cli,'doctor','--url','https://example.com/'],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).error.code,'INVALID_ARGUMENT');
});

test('open URL defaults to a blank page and permits only the exact internal blank URL',()=>{
  assert.equal(openUrl(), 'about:blank');
  assert.equal(openUrl('about:blank'), 'about:blank');
  assert.equal(openUrl('https://example.com'), 'https://example.com/');
  for(const url of ['',null,'about:blank#x','about:blank?x','about:srcdoc','chrome://newtab','data:text/html,x','javascript:alert(1)','https://user:secret@example.com/'])assert.throws(()=>openUrl(url),e=>e.code==='INVALID_URL');
});
test('missing profile selection is not replaced with a default profile even when URL is omitted',async()=>{
  const a=adapter();
  await code(perform('open',{},a,Date.now()+1000),'SELECTION_REQUIRED');
  assert.deepEqual(a.effects,{});
});
