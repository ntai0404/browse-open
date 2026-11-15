import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const dir=path.resolve(process.argv[2]);
const close=fileURLToPath(new URL('./close-owned-native.ps1',import.meta.url));
let busy=false;
const timer=setInterval(check,1000);
function check(){
 if(busy)return;busy=true;
 try {
  if(!fs.existsSync(path.join(dir,'results.json')))return;
  const rounds=JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8'));
  for(const r of rounds){
   const output=path.join(dir,`round-${r.round}.cleanup.json`);
   if(fs.existsSync(output))continue;
   const launch=r.launches.find(l=>l.output?.status==='PASS'&&l.output.data?.selection?.profileDirectory==='Profile 1');
   const pid=r.hostInstances?.[0]?.pid;
   if(r.turnResults.at(-1)?.status!=='SUCCESS'||!pid||!launch||launch.output.data.requestPid!==pid){
    fs.writeFileSync(output,JSON.stringify({status:'FAIL',reason:'No confirmed completed task with a newly owned native process'}));continue;
   }
   try {
    const proof=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',close,'-BrowserPid',String(pid),'-Root',launch.output.data.selection.userDataDir,'-ProfileDirectory','Profile 1'],{encoding:'utf8',timeout:30000,windowsHide:true}));
    fs.writeFileSync(output,JSON.stringify({...proof,round:r.round,agentDoneBeforeCleanup:true},null,2));
    console.log(JSON.stringify({round:r.round,...proof}));
   }catch(e){fs.writeFileSync(output,JSON.stringify({status:'FAIL',reason:'Guarded normal-close failed; no forced termination',diagnostic:String(e.stderr||e.message).slice(0,800)}));console.log('CLEANUP_FAILED round='+r.round);}
  }
  if(fs.existsSync(path.join(dir,'summary.json'))){clearInterval(timer);console.log('CLEANUP_MONITOR_DONE');}
 }catch(e){console.log('CLEANUP_MONITOR_ERROR '+e.message);}finally{busy=false;}
}
check();
