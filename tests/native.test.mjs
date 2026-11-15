import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {launchNative} from '../scripts/native-launch.mjs';
function setup(t) {
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'browse-native-unit-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'User Data');fs.mkdirSync(path.join(root,'Profile 1'),{recursive:true});
 fs.writeFileSync(path.join(root,'Local State'),'{}');fs.writeFileSync(path.join(root,'Profile 1','Preferences'),'{}');
 // Fixture for adapter routing, not a real Chrome binary or runtime claim.
 const exe=path.join(base,'Google','Chrome','Application','chrome.exe');fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,'unit adapter fixture');
 const calls=[];const adapter={effects:{},inventory:async()=>({processes:[],listeners:[]}),nativeLaunch:async o=>{calls.push(o);return {requestPid:99};}};
 return {root,exe,calls,adapter,opts:{executable:exe,'user-data-dir':root,'profile-directory':'Profile 1'}};
}
test('native launch routes exact selected directory and blank URL, without claiming control (mocked OS boundary)',async t=>{
 const f=setup(t),r=await launchNative(f.opts,f.adapter);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].profile,'Profile 1');assert.equal(f.calls[0].url,'about:blank');
 assert.equal(r.assurance,'LAUNCH_REQUEST_ONLY');assert.equal(r.control,'NOT_TESTED');assert.equal(r.tabVerification,'NOT_TESTED');
 assert.deepEqual(f.adapter.effects,{nativeLaunchRequested:true});
});
test('native missing profile never dispatches or creates it',async t=>{
 const f=setup(t);await assert.rejects(launchNative({...f.opts,'profile-directory':'Missing'},f.adapter),e=>e.code==='PROFILE_NOT_FOUND');
 assert.equal(f.calls.length,0);assert.equal(fs.existsSync(path.join(f.root,'Missing')),false);
});
test('native refuses a Chromium substitute and unsupported internal URL',async t=>{
 const f=setup(t);const exe=path.join(path.dirname(f.exe),'chromium.exe');fs.writeFileSync(exe,'unit fixture');
 await assert.rejects(launchNative({...f.opts,executable:exe},f.adapter),e=>e.code==='NATIVE_CHROME_REQUIRED');
 await assert.rejects(launchNative({...f.opts,url:'chrome://settings'},f.adapter),e=>e.code==='INVALID_URL');assert.equal(f.calls.length,0);
});
test('native root occupied by another browser is blocked without restart',async t=>{
 const f=setup(t);const other=path.join(path.dirname(f.exe),'chromium.exe');fs.writeFileSync(other,'unit fixture');
 f.adapter.inventory=async()=>({processes:[{pid:10,executable:other,commandLine:`chromium.exe "--user-data-dir=${f.root}" --profile-directory=Profile\x201`,handle:1}],listeners:[]});
 await assert.rejects(launchNative(f.opts,f.adapter),e=>e.code==='BROWSER_MISMATCH');assert.equal(f.calls.length,0);
});
test('native CLI invalid options return one JSON object and exit 2',()=>{
 const cli=fileURLToPath(new URL('../scripts/native-launch.mjs',import.meta.url));
 const r=spawnSync(process.execPath,[cli,'--autoConnect','true'],{encoding:'utf8',timeout:5000});
 assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).error.code,'INVALID_ARGUMENT');
});
