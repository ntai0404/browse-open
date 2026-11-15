import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {connect,normalizeInventory,host} from '../scripts/core.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(skill,'scripts/browse-open.mjs');
const run=Date.now(), dir=path.join(skill,'artifacts',`antigravity-cold-${run}`);
fs.mkdirSync(dir,{recursive:true});console.log('EVIDENCE_DIR='+dir);
const root=path.resolve('secrets/chrome-chromium-profile'), directory='Default';
function harness(args){const raw=execFileSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000,windowsHide:true});return JSON.parse(raw);}
const before=harness(['doctor']);
fs.writeFileSync(path.join(dir,'doctor-before.json'),JSON.stringify(before,null,2));
const rootInstances=inventory=>inventory.data.instances.filter(p=>p.userDataDir?.toLowerCase()===root.toLowerCase());
async function closeTestBrowser(expectedPid,targetId) {
 const deadline=Date.now()+25000,adapter=host(deadline);
 const inv=normalizeInventory(await adapter.inventory());
 const rows=inv.processes.filter(p=>p.userDataDir?.toLowerCase()===root.toLowerCase());
 if(!rows.length)return {alreadyAbsent:true,remaining:0};
 if(rows.length!==1||rows[0].kind!=='chromium'||rows[0].profileDirectory!==directory||rows[0].pid!==expectedPid)throw Error('Cleanup identity mismatch; do not close an unrelated browser');
 const connection=await connect(inv,{userDataDir:root,profileDirectory:directory},{instance:String(expectedPid)},adapter.remaining);
 let tabClosed=false;
 try {
  if(targetId){const result=await connection.cdp.call('Target.closeTarget',{targetId});tabClosed=result.success;}
  try{await connection.cdp.call('Browser.close');}catch(e){if(e.code!=='CONNECTION_FAILED')throw e;}
 }finally{connection.cdp.disconnect();}
 while(Date.now()<deadline){
  const after=harness(['doctor']);
  if(!rootInstances(after).length){
   try{process.kill(expectedPid,0);}catch{return {pid:expectedPid,tabClosed,browserExited:true,remaining:0};}
  }
  await new Promise(r=>setTimeout(r,200));
 }
 throw Error('Test browser did not exit; refusing a warm next round');
}
const initial=rootInstances(before);
if(initial.length){const cleanup=await closeTestBrowser(initial[0].pid);fs.writeFileSync(path.join(dir,'initial-cleanup.json'),JSON.stringify(cleanup,null,2));}
const sockets=new Set(), hits={};
const server=http.createServer((req,res)=>{const m=req.url.match(/^\/round-(\d+)$/);if(!m){res.writeHead(404);res.end();return;}const n=Number(m[1]);hits[n]=(hits[n]||0)+1;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><title>ChromiumSkillAnti-${run}-${n}</title></head><body><h1>ChromiumSkillAnti-${run}-${n}</h1></body></html>`);});
server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const results=[];
const rounds=Number(process.argv[2]||10);
try {
 for(let round=1;round<=rounds;round++){
  const beforeRound=harness(['doctor']);
  if(rootInstances(beforeRound).length)throw Error('Cold-start precondition failed: selected browser is already running');
  const beforePids=beforeRound.data.instances.map(p=>p.pid);
  console.log(`ROUND=${round} COLD_START_CONFIRMED no selected-profile browser`);
  const url=`http://127.0.0.1:${server.address().port}/round-${round}`;
  const title=`ChromiumSkillAnti-${run}-${round}`;
  const prompt=`Sử dụng skill $browse-open tại ${path.join(skill,'SKILL.md')} để mở tab Chromium GUI.\nNgữ cảnh kiểm thử đã chọn: dùng profile automation hiện có ${root}, profile-directory ${directory}; mở URL ${url}. Browser của profile này hiện chưa chạy. Hãy tự khởi chạy Chromium mới có GUI qua skill rồi mở tab. Không dùng phiên/profile khác. Không tạo profile hoặc thay đổi đăng nhập. Để browser mở khi trả kết quả; bộ điều phối sẽ đóng riêng browser thử này sau khi kiểm chứng để lượt kế tiếp bắt đầu từ trạng thái tắt. Tự đọc skill và gọi harness của nó để thực hiện. Trả lời tối đa 5 dòng gồm trạng thái, PID, targetId, URL và giới hạn nếu có. Không sửa source. Giữ browser sau khi trả kết quả.`;
  fs.writeFileSync(path.join(dir,`round-${round}.prompt.txt`),prompt);
  const child=spawn(path.join(process.env.USERPROFILE,'.gemini/bin/agy.exe'),['--project',path.basename(process.cwd()),'--model','gemini-4-hydrogen-xhigh','--settings',path.join(skill,'tests/antigravity.session.json'),'--input-format','stream-json','--output-format','stream-json'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const log=fs.createWriteStream(path.join(dir,`round-${round}.ndjson`));
  child.stderr.pipe(fs.createWriteStream(path.join(dir,`round-${round}.stderr.log`)));
  let buffer='',conversation,readSkill=false,calledHarness=false,calledOpen=false,toolErrors=[],result,openResult;
  const done=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Agent turn timeout after 240s')),240000);
   child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);if(!result)reject(Error(`CLI exited before result: ${code}`));});
   child.stdout.on('data',c=>{log.write(c);buffer+=c;let cut;while((cut=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,cut);buffer=buffer.slice(cut+1);let e;try{e=JSON.parse(line);}catch{continue;}
    if(e.event==='init'){conversation=e.conversation_id;console.log(`ROUND=${round} CONVERSATION=${conversation}`);}
    const s=e.step_update,t=s?.tool_info;
    if(t&&s.state==='ACTIVE'){console.log(`ROUND=${round} TOOL=${t.name} ${JSON.stringify(t.parameters).slice(0,380)}`);}
    if(t&&s.state==='DONE'){
      const p=JSON.stringify(t.parameters||{});
      if(/read_file|view_file/.test(t.name)&&p.includes('chromium-open')&&p.includes('SKILL.md'))readSkill=true;
      if(t.name==='run_command'&&p.includes('browse-open.mjs')){calledHarness=true;if(/chromium-open\.mjs"?\s+open(?:\s|$)/.test(t.parameters.CommandLine||''))calledOpen=true;}
      if(t.name==='call_mcp_tool'&&t.parameters?.ServerName==='browse_open'){calledHarness=true;if(t.parameters.ToolName==='open'){calledOpen=true;try{openResult=JSON.parse(t.output);}catch{}}}
    }
    if(s?.state==='ERROR')toolErrors.push(t||s);
    if(e.event==='result'){result=e.result;clearTimeout(timer);resolve();}
   }});
  });
  child.stdin.write(JSON.stringify({event:'user',message:{content:prompt}})+'\n');
  let agentError;try{await done;}catch(e){agentError=e.message;}
  let targets=[],verified,verificationError;
  try{
   const current=harness(['doctor']);
   const selected=rootInstances(current);
   if(selected.length!==1||!Number(selected[0].port))throw Error('New selected-profile instance missing or not TCP connectable');
   const instance=selected[0], endpoint=`http://127.0.0.1:${instance.port}`;
   targets=await (await fetch(endpoint+'/json/list',{signal:AbortSignal.timeout(5000)})).json();
   const target=targets.find(t=>t.type==='page'&&t.url===url&&t.title===title);
   if(target)verified=harness(['verify','--user-data-dir',root,'--profile-directory',directory,'--instance',String(instance.pid),'--endpoint',endpoint,'--target',target.id,'--url',url,'--expect-title',title]);
   else verificationError='Requested page URL/title absent from independent CDP listing';
  }catch(e){verificationError=e.message;}
  const record={round,conversation,url,title,readSkill,calledHarness,calledOpen,agentStatus:result?.status,agentResponse:result?.response,agentError,toolErrors,openResult,beforePids,httpHits:hits[round]||0,verified,verificationError,pass:readSkill&&calledHarness&&calledOpen&&result?.status==='SUCCESS'&&verified?.status==='PASS'&&(hits[round]||0)>0&&openResult?.data?.reused===false&&openResult?.effects?.browserStartedPid===verified?.data?.instance?.pid&&!beforePids.includes(verified?.data?.instance?.pid)};
  const currentCleanup=rootInstances(harness(['doctor']));
  try{record.cleanup=currentCleanup.length?await closeTestBrowser(currentCleanup[0].pid,verified?.data?.page?.targetId):{alreadyAbsent:true,remaining:0};}catch(e){record.cleanup={error:e.message};record.pass=false;}
  results.push(record);fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({round,pass:record.pass,readSkill,calledHarness,calledOpen,httpHits:record.httpHits,verificationError,agentError,newPid:verified?.data?.instance?.pid,reused:openResult?.data?.reused,cleanup:record.cleanup}));
  const exited=new Promise(r=>child.once('exit',r));child.stdin.end();await exited;log.end();
  if(record.cleanup.error)throw Error(record.cleanup.error);
 }
 const after=harness(['doctor']);fs.writeFileSync(path.join(dir,'doctor-after.json'),JSON.stringify(after,null,2));
 console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.pass).length,dir}));
}finally{await new Promise(r=>{server.close(r);for(const s of sockets)s.destroy();});}
