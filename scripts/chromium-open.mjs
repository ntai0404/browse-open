#!/usr/bin/env node
import {perform,host,Failure} from './core.mjs';
import map from '../references/capabilities.json' with {type:'json'};
const commands=Object.keys(map.commands);
const options=['timeout','browser','executable','user-data-dir','profile-directory','instance','endpoint','url','target','expect-title'];
let emitted=false, effects={}, timer;
function emit(value,exit){if(emitted)return;emitted=true;clearTimeout(timer);process.stdout.write(JSON.stringify({schemaVersion:1,...value,effects})+'\n',()=>process.exit(exit));}
try {
  const args=process.argv.slice(2),command=args.shift();
  if(command==='--help'||command==='help')emit({status:'PASS',command:'help',commands,options,commandOptions:Object.fromEntries(commands.map(k=>[k,map.commands[k].options])),usage:'node chromium-open.mjs <command> --user-data-dir ROOT --profile-directory DIRECTORY [--browser chrome|chromium] [--url URL] [--timeout 20000]',exitCodes:{0:'PASS',2:'invalid arguments',3:'BLOCKED precondition',4:'connection/timeout',5:'verification FAIL'},unsupported:['profile creation','browser close/restart','pipe takeover','non-Windows mutation']},0);
  else {
    if(!commands.includes(command))throw new Failure('INVALID_COMMAND','Use --help',2);
    const opts={};for(let i=0;i<args.length;i+=2){const k=args[i].replace(/^--/,'');if(!args[i].startsWith('--')||!options.includes(k)||args[i+1]===undefined||opts[k]!==undefined)throw new Failure('INVALID_ARGUMENT','Use named option/value pairs from --help',2);opts[k]=args[i+1];}
    for(const key of Object.keys(opts))if(!map.commands[command].options.includes(key))throw new Failure('INVALID_ARGUMENT',`${key} is not supported by ${command}`,2);
    const timeout=Number(opts.timeout||20000);
    if(!Number.isInteger(timeout)||timeout<500||timeout>120000)throw new Failure('INVALID_TIMEOUT','timeout must be 500..120000 milliseconds',2);
    if(opts.instance && !/^[1-9]\d*$/.test(opts.instance))throw new Failure('INVALID_INSTANCE','instance must be a positive PID',2);
    if(process.platform!=='win32')throw new Failure('UNSUPPORTED_PLATFORM','Only Windows host operations are implemented',3);
    const deadline=Date.now()+timeout;
    timer=setTimeout(()=>emit({status:'FAIL',command,error:{code:'TIMEOUT',message:'Overall operation deadline exceeded; inspect effects before retrying'}},4),timeout);
    const adapter={...host(deadline),effects};
    const data=await perform(command,opts,adapter,deadline);
    emit({status:'PASS',command,data},0);
  }
}catch(e){const known=e instanceof Failure;emit({status:known&&e.exit===3?'BLOCKED':'FAIL',command:process.argv[2]||null,error:{code:known?e.code:'INTERNAL_ERROR',message:known?e.message:'Unexpected harness error',details:known?e.details:{}}},known?e.exit:5);}
