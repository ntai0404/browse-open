#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import readline from 'node:readline';
import map from '../references/capabilities.json' with {type:'json'};
const cli=fileURLToPath(new URL('./chromium-open.mjs',import.meta.url));
const fields={timeout:'timeout',browser:'browser',executable:'executable',userDataDir:'user-data-dir',profileDirectory:'profile-directory',instance:'instance',endpoint:'endpoint',url:'url',target:'target',expectTitle:'expect-title'};
export const tools=Object.entries(map.commands).map(([name,cap])=>({name,description:cap.expectedResult,inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(fields).filter(([,option])=>cap.options.includes(option)).map(([field])=>[field,field==='timeout'?{type:'integer',minimum:500,maximum:120000}:field==='instance'?{type:'integer',minimum:1}:{type:'string',minLength:1}])),required:name==='doctor'?[]:name==='profiles'?['userDataDir']:['userDataDir','profileDirectory',...(name==='verify'?['target','url']:[])],additionalProperties:false},annotations:{readOnlyHint:name!=='open',destructiveHint:false,openWorldHint:name==='open'}}));
export async function invoke(name,args={}) {
  const tool=tools.find(t=>t.name===name);
  if(!tool)throw Error('Unknown tool');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Arguments must be an object');
  for(const key of Object.keys(args)) {
    const schema=tool.inputSchema.properties[key];
    if(!schema)throw Error('Unknown argument: '+key);
    if(schema.type==='integer'&&(!Number.isInteger(args[key])||args[key]<schema.minimum||(schema.maximum&&args[key]>schema.maximum)))throw Error('Invalid integer: '+key);
    if(schema.type==='string'&&(typeof args[key]!=='string'||!args[key].length))throw Error('Invalid string: '+key);
  }
  for(const key of tool.inputSchema.required)if(args[key]===undefined)throw Error('Missing argument: '+key);
  const argv=[cli,name,...Object.entries(args).flatMap(([key,value])=>['--'+fields[key],String(value)])];
  return await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,argv,{stdio:['ignore','pipe','pipe'],windowsHide:true});let out='',err='';
    const timer=setTimeout(()=>{child.kill();reject(Error('Harness process deadline exceeded; inspect browser state before retry'));},(args.timeout||20000)+5000);
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);
    child.once('exit',exitCode=>{clearTimeout(timer);try{const data=JSON.parse(out);if(data.schemaVersion!==1)throw Error('Invalid harness result');resolve({...data,transport:{kind:'mcp-host',exitCode}});}catch{reject(Error('Harness did not return structured JSON'+(err?'; diagnostic output available on host':'')));}});
  });
}
export async function dispatch(request) {
  if(request.id===undefined)return;
  let result;
  try {
    if(request.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'chromium-open',version:'1.0.0'}};
    else if(request.method==='ping')result={};
    else if(request.method==='tools/list')result={tools};
    else if(request.method==='tools/call') {const value=await invoke(request.params?.name,request.params?.arguments);result={content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:value.status!=='PASS'};}
    else return {jsonrpc:'2.0',id:request.id,error:{code:-32601,message:'Method not found'}};
    return {jsonrpc:'2.0',id:request.id,result};
  }catch(e){return {jsonrpc:'2.0',id:request.id,error:{code:-32602,message:e.message}};}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  input.on('line',async line=>{let req;try{req=JSON.parse(line);}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}})+'\n');return;}const response=await dispatch(req);if(response)process.stdout.write(JSON.stringify(response)+'\n');});
}
