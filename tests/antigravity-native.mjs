import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(skill,'artifacts',`antigravity-native-${Date.now()}`);fs.mkdirSync(dir,{recursive:true});
console.log('EVIDENCE_DIR='+dir);
const root=path.join(process.env.LOCALAPPDATA,'Google/Chrome/User Data');
const profile='Profile 1'; // Existing user choice in the parent conversation; supplied only after the agent asks.
const prompt=`dùng skill [$browse-open](<${path.join(skill,'SKILL.md')}>)  để mở chrome GUI lên`;
const profileReply='Tôi chọn Nguyễn Xuân — Profile 1 trong user-data-dir Chrome native đã liệt kê. Giữ Chrome và session đang mở. Không gọi autoConnect hay thao tác hộp thoại cấp quyền.';
const count=Number(process.argv[2]||10),results=[];
function doctor(){return JSON.parse(execFileSync(process.execPath,[path.join(skill,'scripts/browse-open.mjs'),'doctor'],{encoding:'utf8',timeout:30000,windowsHide:true}));}
fs.writeFileSync(path.join(dir,'doctor-before.json'),JSON.stringify(doctor(),null,2));
const cleanupMonitor=spawn(process.execPath,[path.join(skill,'tests/cleanup-native-rounds.mjs'),dir],{stdio:['ignore','inherit','inherit'],windowsHide:true});
for(let round=1;round<=count;round++) {
 const beforeRound=doctor();
 if(beforeRound.data.instances.some(p=>p.userDataDir?.toLowerCase()===root.toLowerCase()))throw Error('Selected native root still running; do not start a new round before cleanup');
 const child=spawn(path.join(process.env.USERPROFILE,'.gemini/bin/agy.exe'),['--project',path.basename(process.cwd()),'--model','gemini-4-hydrogen-xhigh','--settings',path.join(skill,'tests/antigravity.session.json'),'--input-format','stream-json','--output-format','stream-json'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 const log=fs.createWriteStream(path.join(dir,`round-${round}.ndjson`));
 child.stderr.pipe(fs.createWriteStream(path.join(dir,`round-${round}.stderr.log`)));
 const record={round,prompt,readSkill:false,questions:[],turnResults:[],launches:[],toolErrors:[],profileReplySent:false};
 const send=content=>child.stdin.write(JSON.stringify({event:'user',message:{content}})+'\n');
 let buffer='',settled=false;
 await new Promise(resolve=>{
  const finish=()=>{if(!settled){settled=true;clearTimeout(timer);resolve();}};
  const timer=setTimeout(()=>{record.error='TIMEOUT';finish();},300000);
  child.once('error',e=>{record.error=e.message;finish();});
  child.once('exit',code=>{if(!settled){record.error='Agent exited before final result: '+code;finish();}});
  child.stdout.on('data',c=>{log.write(c);buffer+=c;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let e;try{e=JSON.parse(line);}catch{continue;}
   if(e.event==='init'){record.conversation=e.conversation_id;console.log(`ROUND=${round} CONVERSATION=${record.conversation}`);}
   const st=e.step_update,t=st?.tool_info;
   if(t&&st.state==='ACTIVE')console.log(`ROUND=${round} TOOL=${t.name} ${JSON.stringify(t.parameters).slice(0,220)}`);
   if(t&&st.state==='DONE'){
    const params=JSON.stringify(t.parameters||{});
    if(/read_file|view_file/.test(t.name)&&params.includes('browse-open')&&params.includes('SKILL.md'))record.readSkill=true;
    if(t.name==='ask_question')record.questions.push(t);
    if(t.name==='call_mcp_tool'&&t.parameters?.ServerName==='browse_open'&&t.parameters.ToolName==='native_launch'){
     let output;try{output=JSON.parse(t.output);}catch{}
     record.launches.push({args:t.parameters.Arguments,output});
    }
   }
   if(st?.state==='ERROR')record.toolErrors.push(t||st);
   if(e.event==='result'){
    record.turnResults.push(e.result);
    if(!record.launches.length&&!record.profileReplySent){
     const response=e.result?.response||'';
     // Answer only an actual request for profile selection, not other failures.
     if(/profile|hồ sơ/i.test(response)&&/chọn|lựa|choose|select/i.test(response)){
      record.profileReplySent=true;console.log(`ROUND=${round} ANSWERING_PROFILE_SELECTION`);send(profileReply);continue;
     }
    }
    finish();
   }
  }});
  send(prompt);
 });
 let after;
 try{after=doctor();}catch(e){record.hostError=e.message;}
 record.hostInstances=after?.data.instances.filter(p=>p.kind==='chrome'&&p.userDataDir?.toLowerCase()===root.toLowerCase()&&p.profileDirectory===profile&&p.handle>0);
 const launch=record.launches.find(l=>l.output?.status==='PASS'&&l.output.data?.assurance==='LAUNCH_REQUEST_ONLY'&&l.args?.profileDirectory===profile&&l.args?.userDataDir?.replaceAll('/',String.fromCharCode(92)).toLowerCase()===root.toLowerCase()&&(!l.args.url||l.args.url==='about:blank'));
 record.launchRequestPass=!!(record.readSkill&&launch&&record.hostInstances?.length&&!record.error);
 record.tabVerification='NOT_TESTED';record.control='NOT_TESTED';record.coldStart=true;
 results.push(record);fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({round,launchRequestPass:record.launchRequestPass,readSkill:record.readSkill,launches:record.launches.length,profileReplySent:record.profileReplySent,error:record.error,toolErrors:record.toolErrors.length}));
 console.log(`WAITING_FOR_TAB_CLEANUP=${round}`);
 const cleanupFile=path.join(dir,`round-${round}.cleanup.json`),cleanupDeadline=Date.now()+240000;
 while(!fs.existsSync(cleanupFile)&&Date.now()<cleanupDeadline)await new Promise(r=>setTimeout(r,500));
 if(!fs.existsSync(cleanupFile)){record.error='CLEANUP_NOT_CONFIRMED';record.launchRequestPass=false;}
 else {record.cleanup=JSON.parse(fs.readFileSync(cleanupFile,'utf8'));if(record.cleanup.status!=='PASS'){record.error='CLEANUP_FAILED';record.launchRequestPass=false;}}
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
 const exit=new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});child.stdin.end();
 await Promise.race([exit,new Promise(resolve=>setTimeout(resolve,10000))]);log.end();
 if(record.error==='TIMEOUT'||record.error==='CLEANUP_NOT_CONFIRMED'||record.error==='CLEANUP_FAILED'){console.log('STOPPED: timed-out agent may remain active; no browser was killed');break;}
}
const summary={total:results.length,requested:count,launchRequestPassed:results.filter(r=>r.launchRequestPass).length,tabVerification:'NOT_TESTED',control:'NOT_TESTED',coldStart:true,dir};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
fs.writeFileSync(path.join(dir,'doctor-after.json'),JSON.stringify(doctor(),null,2));
console.log(JSON.stringify(summary));
