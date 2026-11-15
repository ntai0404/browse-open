import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {Cdp} from '../scripts/core.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(skill,'scripts/browse-open.mjs');
const run=Date.now(),dir=path.join(skill,'artifacts',`antigravity-native-dom-${run}`);
const rounds=Number(process.argv[2]||10);
if(!Number.isInteger(rounds)||rounds<1||rounds>10)throw Error('rounds must be 1..10');
const root=path.resolve(process.env.BROWSE_NATIVE_TEST_ROOT||'secrets/chrome-native-copy-20261116-005737');
const directory=process.env.BROWSE_NATIVE_TEST_PROFILE||'Profile 1';
const endpoint=process.env.BROWSE_NATIVE_TEST_ENDPOINT||'http://127.0.0.1:4444';
fs.mkdirSync(dir,{recursive:true});console.log('EVIDENCE_DIR='+dir);
function harness(command,extra={}) {
 const opts={browser:'chrome','user-data-dir':root,'profile-directory':directory,endpoint,...extra};
 return JSON.parse(execFileSync(process.execPath,[cli,command,...Object.entries(opts).flatMap(([k,v])=>['--'+k,String(v)])],{encoding:'utf8',timeout:30000,windowsHide:true}));
}
async function targets(){return await (await fetch(endpoint+'/json/list',{signal:AbortSignal.timeout(5000)})).json();}
async function socket(){const v=await (await fetch(endpoint+'/json/version',{signal:AbortSignal.timeout(5000)})).json();return await Cdp.connect(v.webSocketDebuggerUrl,()=>10000);}
const initial=harness('connect');
if(initial.status!=='PASS'||initial.data.instance.kind!=='chrome')throw Error('Selected native Chrome unavailable');
fs.writeFileSync(path.join(dir,'connection-before.json'),JSON.stringify(initial,null,2));
const results=[],events={},loads={};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 const event=u.pathname.match(/^\/round-(\d+)\/event$/);
 if(event){const n=Number(event[1]);(events[n]??=[]).push({value:u.searchParams.get('value'),at:Date.now()});res.end('ok');return;}
 const page=u.pathname.match(/^\/round-(\d+)$/);
 if(!page){res.writeHead(404);res.end();return;}
 const n=Number(page[1]);loads[n]=(loads[n]||0)+1;
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<title>NativeDOM-${run}-${n}</title><h1>Native Chrome DOM round ${n}</h1><label>Proof <input id="probe" autocomplete="off"></label><button id="apply">Apply</button><output id="result">Waiting</output><script>document.querySelector('#apply').onclick=async()=>{const value=document.querySelector('#probe').value;await fetch('/round-${n}/event?value='+encodeURIComponent(value));document.querySelector('#result').textContent=value;document.body.dataset.clickCount=String(Number(document.body.dataset.clickCount||0)+1)}</script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
function save(){fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));}
async function agent(round,prompt){
 const child=spawn(path.join(process.env.USERPROFILE,'.gemini/bin/agy.exe'),['--project',path.basename(process.cwd()),'--model','gemini-4-hydrogen-xhigh','--settings',path.join(skill,'tests/antigravity.session.json'),'--input-format','stream-json','--output-format','stream-json'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 const log=fs.createWriteStream(path.join(dir,`round-${round}.ndjson`));
 child.stderr.pipe(fs.createWriteStream(path.join(dir,`round-${round}.stderr.log`)));
 let buffer='',conversation,result,readSkill=false,error;const tools=[],toolErrors=[];
 try {await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Agent deadline 240s exceeded')),240000);
  child.once('error',e=>{clearTimeout(timer);reject(e);});
  child.once('exit',code=>{clearTimeout(timer);if(!result)reject(Error('Agent exited without result: '+code));});
  child.stdout.on('data',chunk=>{log.write(chunk);buffer+=chunk;let index;
   while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);let e;try{e=JSON.parse(line);}catch{continue;}
    if(e.event==='init'){conversation=e.conversation_id;console.log(`ROUND=${round} CONVERSATION=${conversation}`);}
    const step=e.step_update,t=step?.tool_info;
    if(t&&step.state==='ACTIVE')console.log(`ROUND=${round} TOOL=${t.name} ${JSON.stringify(t.parameters).slice(0,200)}`);
    if(t&&step.state==='DONE'){
     const params=JSON.stringify(t.parameters||{});
     if(/read_file|view_file/.test(t.name)&&params.includes('browse-open')&&params.includes('SKILL.md'))readSkill=true;
     if(t.name==='call_mcp_tool'&&t.parameters?.ServerName==='browse_open')tools.push(t.parameters.ToolName);
     if(t.name==='run_command'&&params.includes('browse-open.mjs')){for(const cmd of ['open','fill','click','read','verify'])if(params.includes(' '+cmd+' '))tools.push(cmd);}
    }
    if(step?.state==='ERROR')toolErrors.push(t||step);
    if(e.event==='result'){result=e.result;clearTimeout(timer);resolve();}
   }
  });
  child.stdin.write(JSON.stringify({event:'user',message:{content:prompt}})+'\n');
 });}catch(e){error=e.message;}
 child.stdin.end();
 if(child.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},8000);child.once('exit',()=>{clearTimeout(timer);resolve();});});
 log.end();return {conversation,result,readSkill,tools,toolErrors,error};
}
try {
 for(let round=1;round<=rounds;round++){
  const url=`http://127.0.0.1:${server.address().port}/round-${round}`,value=`NATIVE-DOM-${run}-${round}`;
  const before=await targets();
  const prompt=`Đọc skill [$browse-open](<${path.join(skill,'SKILL.md')}>) mở Chrome native riêng rồi check thao tác DOM trên đó xem thao tác được không.\nNgữ cảnh test đã được người dùng chọn/cho phép: dùng Chrome native Google đã cài, bản sao profile riêng ${root}, profile-directory ${directory}, endpoint ${endpoint}; reuse đúng browser này và MỞ MỘT TAB MỚI cho lượt ${round}. Không copy lại, không dùng profile gốc hay Chromium, không đóng tab/browser khác, không sửa source.\nTrang kiểm thử: ${url}. Dùng harness CLI/MCP của skill để open, fill #probe với giá trị ${value}, click #apply, rồi read #result đến khi đúng giá trị đó. Không dùng JS eval/desktop input hoặc tự viết Playwright thay harness. Giữ tab thử sau khi done để orchestrator kiểm chứng rồi đóng đúng tab đó trước lượt kế tiếp. Trả tối đa 5 dòng: PASS/FAIL, PID, targetId, URL, readback và giới hạn đăng nhập nếu có.`;
  fs.writeFileSync(path.join(dir,`round-${round}.prompt.txt`),prompt);
  const a=await agent(round,prompt),record={round,url,value,...a,loads:loads[round]||0,events:events[round]||[],beforeIds:before.map(t=>t.id)};
  let owned=[];
  try {
   owned=(await targets()).filter(t=>t.type==='page'&&t.url===url&&!before.some(b=>b.id===t.id));
   record.newTargetIds=owned.map(t=>t.id);
   if(owned.length!==1)throw Error('Expected exactly one fresh test page; observed '+owned.length);
   const target=owned[0];
   record.verify=harness('verify',{target:target.id,url,'expect-title':`NativeDOM-${run}-${round}`});
   record.read=harness('read',{target:target.id,url,selector:'#result'});
   const cdp=await socket();
   try {const {sessionId}=await cdp.call('Target.attachToTarget',{targetId:target.id,flatten:true});
    try {const r=await cdp.call('Runtime.evaluate',{expression:'JSON.stringify({input:document.querySelector("#probe").value,output:document.querySelector("#result").textContent,clickCount:document.body.dataset.clickCount})',returnByValue:true},sessionId);record.independentDom=JSON.parse(r.result.value);}
    finally {await cdp.call('Target.detachFromTarget',{sessionId});}
   }finally{cdp.disconnect();}
   record.pass=a.result?.status==='SUCCESS'&&a.readSkill&&['open','fill','click','read'].every(cmd=>a.tools.includes(cmd))&&record.verify.status==='PASS'&&record.read.data.snapshot.text===value&&record.independentDom.input===value&&record.independentDom.output===value&&record.independentDom.clickCount==='1'&&record.events.length===1&&record.events[0].value===value;
  }catch(e){record.verificationError=e.message;record.pass=false;}
  finally {
   // Explicitly authorized cleanup: only freshly created targets for this round's exact URL.
   const cdp=await socket();try{for(const target of owned)await cdp.call('Target.closeTarget',{targetId:target.id});}finally{cdp.disconnect();}
   const after=await targets();record.cleanup={closedIds:owned.map(t=>t.id),remaining:after.filter(t=>t.url===url).map(t=>t.id),preexistingMissing:before.filter(b=>!after.some(t=>t.id===b.id)).map(t=>t.id)};
   record.cleanup.pass=record.cleanup.remaining.length===0&&record.cleanup.preexistingMissing.length===0;
   record.pass=record.pass&&record.cleanup.pass;
  }
  results.push(record);save();console.log(JSON.stringify({round,pass:record.pass,readSkill:record.readSkill,tools:record.tools,dom:record.independentDom,events:record.events.length,cleanup:record.cleanup,agentError:record.error,verificationError:record.verificationError}));
  if(!record.cleanup.pass)throw Error('Cleanup/baseline verification failed; stopping before next case');
 }
 const summary={total:results.length,passed:results.filter(r=>r.pass).length,cleaned:results.filter(r=>r.cleanup.pass).length,distinctConversations:new Set(results.map(r=>r.conversation)).size,scope:'Ten fresh agent conversations and fresh tabs; reused same selected copied-profile native browser, not cold browser launches',dir};
 fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));console.log('SUMMARY='+JSON.stringify(summary));
 if(summary.passed!==rounds)process.exitCode=1;
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
