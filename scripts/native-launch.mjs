#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Failure,requireThat,profile,openUrl,host,normalizeInventory} from './core.mjs';

export async function launchNative(opts,adapter) {
  const selection=profile(opts['user-data-dir'],opts['profile-directory']);
  const url=openUrl(opts.url);
  const inv=normalizeInventory(await adapter.inventory());
  const same=(a,b)=>a&&b&&fs.realpathSync(a).toLowerCase()===fs.realpathSync(b).toLowerCase();
  const exe=opts.executable;
  requireThat(exe&&fs.existsSync(exe),'BROWSER_NOT_FOUND','Pass the installed native Chrome executable');
  requireThat(/[\\/]Google[\\/]Chrome[\\/]Application[\\/]chrome\.exe$/i.test(exe),'NATIVE_CHROME_REQUIRED','Do not substitute Chrome for Testing or Chromium');
  requireThat(inv.processes.every(p=>p.inspectable),'PROFILE_OCCUPANCY_UNKNOWN','Process ownership cannot be inspected');
  const rows=inv.processes.filter(p=>p.userDataDir&&same(p.userDataDir,selection.userDataDir));
  requireThat(rows.every(p=>same(p.executable,exe)),'BROWSER_MISMATCH','Selected root is in use by a different executable');
  adapter.effects.nativeLaunchRequested=true;
  const result=await adapter.nativeLaunch({executable:exe,root:selection.userDataDir,profile:selection.profileDirectory,url});
  return {selection,executable:exe,url,requestPid:result.requestPid,assurance:'LAUNCH_REQUEST_ONLY',tabVerification:'NOT_TESTED',control:'NOT_TESTED',notice:'Chrome accepted a native launch request; browser may forward it to an existing process. No tab/profile/DOM verification or debugging connection is claimed.'};
}

async function main() {
  let effects={},timer;
  const emit=(value,exit)=>{clearTimeout(timer);process.stdout.write(JSON.stringify({schemaVersion:1,command:'native-launch',...value,effects})+'\n',()=>process.exit(exit));};
  try {
    const args=process.argv.slice(2);
    if(args.length===1&&args[0]==='--help')return emit({status:'PASS',data:{usage:'node native-launch.mjs --executable EXE --user-data-dir ROOT --profile-directory DIRECTORY [--url URL] [--timeout 20000]',assurance:'Launch dispatch only; use an existing authorized browser connection to verify/control'}},0);
    const opts={},allowed=['executable','user-data-dir','profile-directory','url','timeout'];
    for(let i=0;i<args.length;i+=2){const k=args[i].replace(/^--/,'');requireThat(args[i].startsWith('--')&&allowed.includes(k)&&args[i+1]!==undefined&&opts[k]===undefined,'INVALID_ARGUMENT','Use --help',2);opts[k]=args[i+1];}
    const timeout=Number(opts.timeout||20000);
    requireThat(Number.isInteger(timeout)&&timeout>=500&&timeout<=120000,'INVALID_TIMEOUT','timeout must be 500..120000',2);
    requireThat(process.platform==='win32','UNSUPPORTED_PLATFORM','Native launch is implemented on Windows only');
    timer=setTimeout(()=>emit({status:'FAIL',error:{code:'TIMEOUT',message:'Inspect Chrome before retrying; a launch request may have been dispatched'}},4),timeout);
    const data=await launchNative(opts,{...host(Date.now()+timeout),effects});
    emit({status:'PASS',data},0);
  }catch(e){const known=e instanceof Failure;emit({status:known&&e.exit===3?'BLOCKED':'FAIL',error:{code:known?e.code:'INTERNAL_ERROR',message:known?e.message:'Unexpected launcher error'}},known?e.exit:5);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
