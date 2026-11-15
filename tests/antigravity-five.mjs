import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(skill,'scripts/chromium-open.mjs');
const run=Date.now(), dir=path.join(skill,'artifacts',`antigravity-${run}`);
fs.mkdirSync(dir,{recursive:true});console.log('EVIDENCE_DIR='+dir);
const root=path.resolve('secrets/chrome-chromium-profile'), directory='Default';
function harness(args){const raw=execFileSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000,windowsHide:true});return JSON.parse(raw);}
const before=harness(['doctor']);
fs.writeFileSync(path.join(dir,'doctor-before.json'),JSON.stringify(before,null,2));
const instance=before.data.instances.find(p=>p.userDataDir?.toLowerCase()===root.toLowerCase()&&p.profileDirectory===directory&&Number(p.port)>0);
if(!instance)throw Error('Existing authorized test profile has no verified TCP candidate; do not substitute a profile');
const endpoint=`http://127.0.0.1:${instance.port}`;
const sockets=new Set(), hits={};
const server=http.createServer((req,res)=>{const m=req.url.match(/^\/round-(\d+)$/);if(!m){res.writeHead(404);res.end();return;}const n=Number(m[1]);hits[n]=(hits[n]||0)+1;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><title>ChromiumSkillAnti-${run}-${n}</title></head><body><h1>ChromiumSkillAnti-${run}-${n}</h1></body></html>`);});
server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const results=[];
const rounds=Number(process.argv[2]||5);
try {
 for(let round=1;round<=rounds;round++){
  const url=`http://127.0.0.1:${server.address().port}/round-${round}`;
  const title=`ChromiumSkillAnti-${run}-${round}`;
  const prompt=`Sử dụng skill $chromium-open tại ${path.join(skill,'SKILL.md')} để mở tab Chromium GUI.\nNgữ cảnh kiểm thử đã chọn: dùng profile automation hiện có ${root}, profile-directory ${directory}; mở URL ${url}. Không tạo profile, không đóng browser hoặc thay đổi đăng nhập. Tự đọc skill và gọi harness của nó để thực hiện. Trả lời tối đa 5 dòng gồm trạng thái, PID, targetId, URL và giới hạn nếu có. Không sửa source. Giữ browser sau khi trả kết quả.`;
  fs.writeFileSync(path.join(dir,`round-${round}.prompt.txt`),prompt);
  const child=spawn(path.join(process.env.USERPROFILE,'.gemini/bin/agy.exe'),['--project',path.basename(process.cwd()),'--model','gemini-4-hydrogen-xhigh','--settings',path.join(skill,'tests/antigravity.session.json'),'--input-format','stream-json','--output-format','stream-json'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const log=fs.createWriteStream(path.join(dir,`round-${round}.ndjson`));
  child.stderr.pipe(fs.createWriteStream(path.join(dir,`round-${round}.stderr.log`)));
  let buffer='',conversation,readSkill=false,calledHarness=false,calledOpen=false,toolErrors=[],result;
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
      if(t.name==='run_command'&&p.includes('chromium-open.mjs')){calledHarness=true;if(/chromium-open\.mjs"?\s+open(?:\s|$)/.test(t.parameters.CommandLine||''))calledOpen=true;}
      if(t.name==='call_mcp_tool'&&t.parameters?.ServerName==='chromium_open'){calledHarness=true;if(t.parameters.ToolName==='open')calledOpen=true;}
    }
    if(s?.state==='ERROR')toolErrors.push(t||s);
    if(e.event==='result'){result=e.result;clearTimeout(timer);resolve();}
   }});
  });
  child.stdin.write(JSON.stringify({event:'user',message:{content:prompt}})+'\n');
  let agentError;try{await done;}catch(e){agentError=e.message;}
  let targets=[],verified,verificationError;
  try{
   targets=await (await fetch(endpoint+'/json/list',{signal:AbortSignal.timeout(5000)})).json();
   const target=targets.find(t=>t.type==='page'&&t.url===url&&t.title===title);
   if(target)verified=harness(['verify','--user-data-dir',root,'--profile-directory',directory,'--instance',String(instance.pid),'--endpoint',endpoint,'--target',target.id,'--url',url,'--expect-title',title]);
   else verificationError='Requested page URL/title absent from independent CDP listing';
  }catch(e){verificationError=e.message;}
  const record={round,conversation,url,title,readSkill,calledHarness,calledOpen,agentStatus:result?.status,agentResponse:result?.response,agentError,toolErrors,httpHits:hits[round]||0,verified,verificationError,pass:readSkill&&calledHarness&&calledOpen&&result?.status==='SUCCESS'&&verified?.status==='PASS'&&(hits[round]||0)>0};
  results.push(record);fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({round,pass:record.pass,readSkill,calledHarness,calledOpen,httpHits:record.httpHits,verificationError,agentError}));
  const exited=new Promise(r=>child.once('exit',r));child.stdin.end();await exited;log.end();
 }
 const after=harness(['doctor']);fs.writeFileSync(path.join(dir,'doctor-after.json'),JSON.stringify(after,null,2));
 console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.pass).length,dir}));
}finally{await new Promise(r=>{server.close(r);for(const s of sockets)s.destroy();});}
