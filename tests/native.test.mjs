import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {perform,connect,normalizeInventory} from '../scripts/core.mjs';
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'browse-native-port-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'selected-agis');fs.mkdirSync(path.join(root,'Profile 1'),{recursive:true});
 fs.writeFileSync(path.join(root,'Local State'),'{}');fs.writeFileSync(path.join(root,'Profile 1','Preferences'),'{}');
 const executable=path.join(base,'Google','Chrome','Application','chrome.exe');fs.mkdirSync(path.dirname(executable),{recursive:true});fs.writeFileSync(executable,'test fixture; never executed');
 return {root,executable};
}
test('native selected instance on another requested port is blocked before CDP',async t=>{
 const {root,executable}=fixture(t);
 const inv=normalizeInventory({processes:[{pid:99,executable,commandLine:`chrome.exe "--user-data-dir=${root}" --profile-directory="Profile 1" --remote-debugging-port=9555`,handle:1}],listeners:[]});
 await assert.rejects(connect(inv,{userDataDir:root,profileDirectory:'Profile 1'},{browser:'chrome',port:'4444'},()=>1000),e=>e.code==='PORT_MISMATCH');
});
test('native launch requested occupied port preserves owner and never launches',async t=>{
 const {root,executable}=fixture(t);const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>server.close(r)));
 let launched=false;
 await assert.rejects(perform('open',{browser:'chrome',executable,'user-data-dir':root,'profile-directory':'Profile 1',port:String(server.address().port)},{inventory:async()=>({processes:[],listeners:[]}),effects:{},launch:()=>{launched=true;}},Date.now()+5000),e=>e.code==='PORT_IN_USE');
 assert.equal(launched,false);assert.equal(server.listening,true);
});

test('native original root is blocked before attach or launch',async t=>{
 const {root}=fixture(t);const ordinary=path.join(path.dirname(root),'BrowseOpenData');fs.renameSync(root,ordinary);
 await assert.rejects(perform('open',{browser:'chrome','user-data-dir':ordinary,'profile-directory':'Profile 1'},{inventory:async()=>({processes:[],listeners:[]}),effects:{}},Date.now()+5000),e=>e.code==='AGIS_PROFILE_REQUIRED');
});
