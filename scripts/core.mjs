import fs from 'node:fs';
import {nativePlan,sourceChoice} from './plan.mjs';
import {discoverAgis} from './agis.mjs';
import {domAction} from './dom.mjs';
import {copyProfile} from './profile-copy.mjs';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

export class Failure extends Error {
  constructor(code, message, exit=3, details={}) { super(message); Object.assign(this,{code,exit,details}); }
}
export function requireThat(ok, code, message, exit=3, details={}) {
  if(!ok) throw new Failure(code,message,exit,details);
}
const key = p => {try{return fs.realpathSync.native(p).toLowerCase();}catch{return path.resolve(p).toLowerCase();}};
const same = (a,b) => !!a && !!b && key(a)===key(b);
export function flag(line='', name) {
  const n=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const m=String(line).match(new RegExp('(?:^|\\s)(?:"--'+n+'(?:=|\\s+)([^"]*)"|--'+n+'(?:=|\\s+)(?:"([^"]*)"|([^\\s"]+)))'));
  return m ? (m[1]??m[2]??m[3]) : null;
}
export function endpoint(value) {
  let u;try{u=new URL(value);}catch{throw new Failure('INVALID_ENDPOINT','Use a local HTTP CDP endpoint',2);}
  requireThat(u.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname) && u.port && !u.username && !u.password && !u.search && !u.hash && u.pathname==='/', 'INVALID_ENDPOINT','Only explicit loopback HTTP host:port is supported',2);
  if(u.hostname==='localhost')u.hostname='127.0.0.1';
  return u.origin;
}
export function profile(root, directory) {
  requireThat(!['Guest Profile','System Profile'].includes(directory),'PROFILE_UNSUPPORTED','Guest and system profiles are not supported for persistent selected-profile launch');
  requireThat(root && directory,'SELECTION_REQUIRED','Pass --user-data-dir and --profile-directory; display names are not identifiers',2);
  requireThat(directory!=='.' && directory!=='..' && !/[\\/"\x00-\x1f]/.test(directory),'INVALID_PROFILE_DIRECTORY','Profile directory must be one existing directory key',2);
  requireThat(fs.existsSync(root) && fs.statSync(root).isDirectory(),'PROFILE_NOT_FOUND','Selected user-data directory does not exist');
  root=fs.realpathSync(root);
  requireThat(fs.existsSync(path.join(root,'Local State')),'PROFILE_METADATA_INVALID','Selected root has no Local State; do not initialize a new browser root');
  requireThat(fs.readdirSync(root).includes(directory),'PROFILE_NOT_FOUND','Use the exact profile-directory key from profiles');
  const p=path.join(root,directory);
  requireThat(fs.existsSync(path.join(p,'Preferences')),'PROFILE_NOT_FOUND','Selected profile Preferences do not exist');
  requireThat(same(path.dirname(fs.realpathSync(p)),root),'PROFILE_OUTSIDE_ROOT','Profile symlink/junction escapes the selected root');
  return {userDataDir:root, profileDirectory:directory};
}
export function profiles(root) {
  requireThat(root && fs.existsSync(root),'PROFILE_NOT_FOUND','Specify an existing --user-data-dir');
  root=fs.realpathSync(root);
  let state={};
  const local=path.join(root,'Local State');
  if(fs.existsSync(local)) {
    try{state=JSON.parse(fs.readFileSync(local,'utf8'));}catch{throw new Failure('PROFILE_METADATA_INVALID','Local State is not valid JSON');}
  }
  const cache=state.profile?.info_cache||{};
  const dirs=new Set([...Object.keys(cache),...fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&fs.existsSync(path.join(root,d.name,'Preferences'))).map(d=>d.name)]);
  return [...dirs].filter(d=>!['Guest Profile','System Profile'].includes(d)).sort().map((directory,index)=>({index:index+1,userDataDir:root,profileDirectory:directory,displayName:cache[directory]?.name||null,exists:fs.existsSync(path.join(root,directory,'Preferences'))}));
}
function ps(operation, payload, remaining) {
  try {
    const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./windows.ps1',import.meta.url)),'-Operation',operation,...(payload?['-Payload',Buffer.from(JSON.stringify(payload)).toString('base64')]:[])],{encoding:'utf8',timeout:remaining(),windowsHide:true,maxBuffer:8*1024*1024});
    return JSON.parse(raw.replace(/^\uFEFF/,''));
  } catch(e){throw new Failure(e.code==='ETIMEDOUT'?'TIMEOUT':'HOST_INSPECTION_FAILED','Windows helper failed; run from an authorized host terminal',e.code==='ETIMEDOUT'?4:3);}
}
export function host(deadline) {
  const remaining=()=>{const ms=deadline-Date.now();requireThat(ms>0,'TIMEOUT','Operation deadline exceeded',4);return ms;};
  return {remaining, inventory:()=>ps('inventory',null,remaining),launch:o=>ps('launch',o,remaining)};
}
export function normalizeInventory(raw) {
  const defaultChrome=process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA,'Google/Chrome/User Data') : null;
  return {...raw,processes:raw.processes.map(p=>{
    const explicit=flag(p.commandLine,'user-data-dir');
    const inferred=!explicit && kind(p.executable)==='chrome-beta' ? (process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome Beta/User Data')) : !explicit && kind(p.executable)==='chrome' ? defaultChrome : null;
    return {pid:p.pid,executable:p.executable,kind:kind(p.executable),sessionId:p.sessionId,handle:p.handle,title:p.title,userDataDir:explicit||inferred,rootSource:explicit?'argument':inferred?'standard-chrome-location':'unknown',profileDirectory:flag(p.commandLine,'profile-directory'),port:flag(p.commandLine,'remote-debugging-port'),pipe:/(?:^|\s)--remote-debugging-pipe(?:\s|$)/.test(p.commandLine||''),inspectable:!!p.commandLine};
  })};
}
export function kind(exe='') { return /[\\/]Google[\\/]Chrome Beta[\\/]Application[\\/]chrome\.exe$/i.test(exe) ? 'chrome-beta' : /[\\/]Google[\\/]Chrome[\\/]Application[\\/]chrome\.exe$/i.test(exe) ? 'chrome' : /(?:ms-playwright[\\/]chromium|[\\/]chromium(?:[\\/]|\.exe$))/i.test(exe) ? 'chromium' : 'unknown'; }

export function binaries(inv, explicit) {
  const candidates=[explicit,...inv.processes.map(p=>p.executable),process.env.CHROMIUM_EXECUTABLE];
  for(const base of [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean)) candidates.push(path.join(base,'Google/Chrome/Application/chrome.exe'),path.join(base,'Google/Chrome Beta/Application/chrome.exe'));
  try {const req=createRequire(path.join(process.cwd(),'__browse_open__.cjs'));candidates.push(req('playwright-core').chromium.executablePath());}catch{}
  return [...new Set(candidates.filter(Boolean).filter(p=>fs.existsSync(p)).map(p=>fs.realpathSync(p)))].map(executable=>({kind:kind(executable),executable}));
}
export async function httpJson(url, remaining, method='GET') {
  try {
    const r=await fetch(url,{method,signal:AbortSignal.timeout(remaining()),redirect:'error'});
    requireThat(r.ok,'CONNECTION_FAILED',`CDP HTTP returned ${r.status}`,4);
    return await r.json();
  }catch(e){if(e instanceof Failure)throw e;throw new Failure(['TimeoutError','AbortError'].includes(e.name)?'TIMEOUT':'CONNECTION_FAILED','CDP endpoint did not respond with JSON before the deadline',4);}
}
export class Cdp {
  constructor(ws,remaining){this.ws=ws;this.remaining=remaining;this.next=0;this.pending=new Map();
    ws.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Failure('CDP_ERROR',m.error.message,4)):p.resolve(m.result);}});
    ws.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Failure('CONNECTION_FAILED','CDP socket closed',4));}this.pending.clear();});
  }
  static async connect(url,remaining) {
    const ws=new WebSocket(url);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.close();reject(new Failure('TIMEOUT','CDP socket open timed out',4));},remaining());
      ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Failure('CONNECTION_FAILED','CDP socket connection failed',4));},{once:true});
    });
    return new Cdp(ws,remaining);
  }
  call(method,params={},sessionId){return new Promise((resolve,reject)=>{
    const id=++this.next;
    const timer=setTimeout(()=>{this.pending.delete(id);reject(new Failure('TIMEOUT',`CDP ${method} timed out`,4));},this.remaining());
    this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });}
  disconnect(){this.ws.close();}
}
export function matching(inv,selection) {
  return inv.processes.filter(p=>same(p.userDataDir,selection.userDataDir));
}
export async function connect(inv,selection,opts,remaining) {
  const rows=matching(inv,selection).filter(p=>!opts.instance || p.pid===Number(opts.instance));
  requireThat(rows.length===1,'INSTANCE_NOT_FOUND','Select one running instance for this user-data directory',3);
  const instance=rows[0];
  if(instance.kind==='chrome')requireThat(path.basename(selection.userDataDir).endsWith('-agis'),'AGIS_PROFILE_REQUIRED','Native Chrome requires a selected -agis root; discover existing copies or ask for the source profile first');
  requireThat(instance.inspectable,'INSTANCE_UNINSPECTABLE','Cannot inspect browser command line');
  requireThat(!opts.executable || same(instance.executable,opts.executable),'BROWSER_MISMATCH','Executable differs from the selected instance');
  requireThat(!opts.browser || instance.kind===opts.browser,'BROWSER_MISMATCH','Chrome/Chromium kind differs from selected instance');
  requireThat(['chromium','chrome'].includes(instance.kind),'BROWSER_UNSUPPORTED','Use Chromium or Chrome native; Beta is unsupported');
  if(opts.port)requireThat(Number(instance.port)===Number(opts.port),'PORT_MISMATCH','Existing browser uses a different port; do not restart it');
  let address=opts.endpoint;
  if(!address && Number(instance.port)>0)address=`http://127.0.0.1:${instance.port}`;
  if(!address && instance.port==='0') {
    const file=path.join(selection.userDataDir,'DevToolsActivePort');
    if(fs.existsSync(file)){const port=fs.readFileSync(file,'utf8').split(/\r?\n/)[0];if(/^\d+$/.test(port))address=`http://127.0.0.1:${port}`;}
  }
  requireThat(address,'INSTANCE_NOT_CONNECTABLE',instance.pipe?'Existing instance uses a pipe owned by another client; reuse that client':'No TCP CDP endpoint; do not restart the browser');
  requireThat(instance.profileDirectory===selection.profileDirectory,'PROFILE_UNVERIFIED','Running instance does not explicitly identify the selected profile; do not guess or restart');
  address=endpoint(address);
  const port=Number(new URL(address).port);
  requireThat(inv.listeners.some(x=>x.port===port && x.pid===instance.pid && ['127.0.0.1','[::1]','::1'].includes(x.address)),'ENDPOINT_OWNER_MISMATCH','Loopback CDP port is not owned by the selected browser PID',3);
  const version=await httpJson(address+'/json/version',remaining);
  requireThat(typeof version.webSocketDebuggerUrl==='string','CONNECTION_FAILED','CDP browser websocket missing',4);
  const ws=new URL(version.webSocketDebuggerUrl);
  requireThat(ws.protocol==='ws:' && ['127.0.0.1','localhost','[::1]'].includes(ws.hostname) && Number(ws.port)===port && !ws.username && !ws.password && ws.pathname.startsWith('/devtools/browser/'),'ENDPOINT_MISMATCH','Browser websocket is outside the verified local endpoint');
  const cdp=await Cdp.connect(ws.href,remaining);
  try {
    const processes=await cdp.call('SystemInfo.getProcessInfo');
    requireThat(processes.processInfo.some(p=>p.type==='browser'&&p.id===instance.pid),'BROWSER_PID_MISMATCH','CDP process ID does not match OS owner');
    let command;
    try {command=await cdp.call('Browser.getBrowserCommandLine');}
    catch(e) {
      if(instance.kind!=='chrome'||e.code!=='CDP_ERROR'||!e.message.includes('--enable-automation'))throw e;
      // Existing native Chrome may omit enable-automation. Verify its actual profile path.
      const {targetId}=await cdp.call('Target.createTarget',{url:'chrome://version/'});
      try {
        const {sessionId}=await cdp.call('Target.attachToTarget',{targetId,flatten:true});
        while(true) {
          const r=await cdp.call('Runtime.evaluate',{expression:'document.querySelector("#profile_path")?.textContent',returnByValue:true},sessionId);
          if(r.result.value) {requireThat(same(r.result.value.trim(),path.join(selection.userDataDir,selection.profileDirectory)),'PROFILE_MISMATCH','Chrome version page reports a different profile path');break;}
          remaining();await new Promise(r=>setTimeout(r,100));
        }
      } finally {await cdp.call('Target.closeTarget',{targetId});}
    }
    if(command)requireThat(command.arguments.some(a=>a===`--profile-directory=${selection.profileDirectory}`) && command.arguments.some(a=>a.startsWith('--user-data-dir=')&&same(a.slice(16),selection.userDataDir)),'PROFILE_MISMATCH','CDP command line does not match selected root/profile');
    await cdp.call('Browser.getVersion');
    return {cdp,instance,address};
  } catch(e){cdp.disconnect();throw e;}
}
export async function verifyTab(cdp,targetId,expectedUrl,remaining,expectedTitle) {
  let last;
  const {sessionId}=await cdp.call('Target.attachToTarget',{targetId,flatten:true});
  try {
    while(true) {
      const result=await cdp.call('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,title:document.title,readyState:document.readyState,bodyPresent:!!document.body,bodyTextLength:document.body?.innerText?.length||0})',returnByValue:true},sessionId);
      try{last=JSON.parse(result.result.value);}catch{throw new Failure('VERIFICATION_FAILED','Page did not return DOM evidence',5);}
      if(last.url===expectedUrl && ['interactive','complete'].includes(last.readyState) && last.bodyPresent && (expectedTitle===undefined || last.title===expectedTitle))break;
      remaining();await new Promise(r=>setTimeout(r,100));
    }
    const {targetInfo}=await cdp.call('Target.getTargetInfo',{targetId});
    requireThat(targetInfo.type==='page'&&targetInfo.url===expectedUrl,'VERIFICATION_FAILED','Target URL differs from DOM evidence',5);
    return {targetId,...last,targetUrl:targetInfo.url,verified:true};
  }finally{try{await cdp.call('Target.detachFromTarget',{sessionId});}catch{}}
}
async function freePort() {return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
export function openUrl(value='about:blank') {
  let u;try{u=new URL(value);}catch{throw new Failure('INVALID_URL','Pass an absolute HTTP(S) URL or about:blank',2);}
  requireThat(value==='about:blank'||(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password),'INVALID_URL','Only HTTP(S) URLs without credentials or exact about:blank are supported',2);
  return u.href;
}
export async function perform(command,opts,adapter,deadline) {
  const remaining=()=>{const n=deadline-Date.now();requireThat(n>0,'TIMEOUT','Operation deadline exceeded',4);return n;};
  if(command==='open')opts={...opts,url:openUrl(opts.url)};
  if(['read','fill','click'].includes(command)) {
    requireThat(opts.target&&opts.url,'VERIFICATION_SELECTION_REQUIRED','DOM commands require --target and expected exact --url',2);
    opts={...opts,url:openUrl(opts.url)};
    if(command!=='read')requireThat(opts.selector,'SELECTOR_REQUIRED','Pass --selector',2);
    if(command==='fill')requireThat(opts.value!==undefined,'VALUE_REQUIRED','Pass --value, including empty string to clear',2);
  }
  if(command==='copy-profile')return await copyProfile(opts,remaining,adapter.effects);
  if(opts.port!==undefined)requireThat(/^[0-9]+$/.test(opts.port)&&Number(opts.port)>=1024&&Number(opts.port)<=65535,'INVALID_PORT','port must be 1024..65535',2);
  if(command==='profiles')return {profiles:profiles(opts['user-data-dir'])};
  let inv=normalizeInventory(await adapter.inventory());
  if(command==='doctor') {
    const data={agisProfiles:discoverAgis([process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/User Data'),process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Chromium/User Data'),opts['user-data-dir'],...inv.processes.map(p=>p.userDataDir),path.join(process.cwd(),'secrets','placeholder')]),os:inv.os,node:process.version,browsers:binaries(inv,opts.executable),instances:inv.processes,roots:[...new Set([process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/User Data'),process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Chromium/User Data'),process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome Beta/User Data'),opts['user-data-dir'],...inv.processes.map(p=>p.userDataDir)].filter(p=>p&&fs.existsSync(p)))],capabilities:{tcpCdp:true,pipeTakeover:false,createProfile:false,closeBrowser:false,platform:'win32'}};
    const sourceProfiles=data.roots.filter(root=>!path.basename(root).endsWith('-agis')&&/[\\/]Google[\\/]Chrome[\\/]User Data$/i.test(root)).flatMap(root=>{try{return profiles(root).filter(p=>p.exists).map(sourceChoice);}catch{return [];}});
    return {...data,sourceProfiles,nextAction:nativePlan(inv,data.agisProfiles,sourceProfiles)};
  }
  const selection=profile(opts['user-data-dir'],opts['profile-directory']);
  if(opts.browser==='chrome')requireThat(path.basename(selection.userDataDir).endsWith('-agis'),'AGIS_PROFILE_REQUIRED','Do not open the original Chrome profile or BrowseOpenData. Call doctor: reuse a valid agisProfiles selection, or ask the user to choose a source profile and copy to its sibling <display-name>-agis root. Do not offer Chromium/manual launch alternatives.');
  if(opts.browser)requireThat(['chromium','chrome'].includes(opts.browser),'INVALID_BROWSER','Use chromium or chrome; Beta is unsupported',2);
  if(opts.executable)requireThat(fs.existsSync(opts.executable),'BROWSER_NOT_FOUND','Selected executable does not exist');
  let existing=matching(inv,selection), launched=false;
  if(command==='open' && existing.length===0 && !opts.instance && !opts.endpoint) {
    requireThat(opts.browser || opts.executable,'BROWSER_SELECTION_REQUIRED','Specify --browser chromium|chrome or --executable',2);
    const choices=binaries(inv,opts.executable).filter(b=>(!opts.browser||b.kind===opts.browser)&&(!opts.executable||same(b.executable,opts.executable)));
    requireThat(choices.length>0,'BROWSER_NOT_FOUND','No matching browser executable found');
    requireThat(choices.length===1,'BROWSER_AMBIGUOUS','Several executables match; pass --executable');
    const exe=choices[0].executable;
    requireThat(['chromium','chrome'].includes(choices[0].kind),'BROWSER_UNSUPPORTED','Executable is not discovered Chromium or Chrome native');
    if(choices[0].kind==='chrome')requireThat(path.basename(selection.userDataDir).endsWith('-agis'),'AGIS_PROFILE_REQUIRED','Native Chrome requires a selected -agis root; never launch BrowseOpenData or the original personal root');
    requireThat(!inv.processes.some(p=>!p.inspectable || (!p.userDataDir && same(p.executable,exe))),'PROFILE_OCCUPANCY_UNKNOWN','A running browser has unknown profile ownership; cannot safely launch');
    const protectedRoots=process.env.LOCALAPPDATA?['Google/Chrome/User Data','Google/Chrome Beta/User Data','Chromium/User Data'].map(p=>path.join(process.env.LOCALAPPDATA,p)):[];
    requireThat(!protectedRoots.some(root=>same(selection.userDataDir,root)),'DEFAULT_PROFILE_CDP_UNSUPPORTED','Use an explicitly selected existing automation root; do not enable CDP on a default personal root');
    const port=opts.port?Number(opts.port):4444;
    {
      try {await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});}
      catch {throw new Failure('PORT_IN_USE','Requested loopback port is unavailable; ask the user to enter another port; never auto-select or stop its owner');}
    }
    const started=await adapter.launch({browser:choices[0].kind,executable:exe,root:selection.userDataDir,profile:selection.profileDirectory,port});
    opts={...opts,executable:exe,instance:String(started.pid)};launched=true;
    adapter.effects.browserStartedPid=started.pid;
    while(true){
      inv=normalizeInventory(await adapter.inventory());
      if(inv.processes.some(p=>p.pid===started.pid) && inv.listeners.some(x=>x.port===port&&x.pid===started.pid))break;
      remaining();await new Promise(r=>setTimeout(r,200));
    }
  }
  const connection=await (adapter.connect||connect)(inv,selection,opts,remaining);
  const {cdp,instance,address}=connection;
  try {
    if(command==='connect'||command==='tabs') {
      const {targetInfos}=await cdp.call('Target.getTargets');
      return {selection,instance,endpoint:address,reused:true,tabs:targetInfos.filter(t=>t.type==='page').map(t=>({targetId:t.targetId,title:t.title,url:t.url}))};
    }
    if(['read','fill','click'].includes(command))return await domAction(command,opts,cdp,instance,address,remaining,adapter.effects);
    let targetId=opts.target;
    if(command==='open') {
      const created=await cdp.call('Target.createTarget',{url:opts.url});targetId=created.targetId;
      adapter.effects.tabCreatedId=targetId;
    }
    requireThat(targetId&&opts.url,'VERIFICATION_SELECTION_REQUIRED','verify requires --target and --url',2);
    const page=await verifyTab(cdp,targetId,opts.url,remaining,opts['expect-title']);
    const after=normalizeInventory(await adapter.inventory()).processes.find(p=>p.pid===instance.pid);
    requireThat(after && after.handle>0,'GUI_NOT_OBSERVED','Page works but the host did not observe a browser window',5,{page});
    return {selection,endpoint:address,instance:after,reused:!launched,page,verification:{cdpOwner:true,profileCommandLine:true,dom:true,targetUrl:true,windowHandle:true,userVisualConfirmation:'NOT_TESTED'}};
  }finally{cdp.disconnect();}
}
